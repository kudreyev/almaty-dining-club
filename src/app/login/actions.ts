'use server'

import { createHash, randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import {
  createWhatsAppLoginChallenge,
  NoAccountError,
  normalizePhoneToE164,
  sendWhatsAppVerificationCode,
} from '@/lib/auth/whatsapp-login'
import { normalizeToE164Like } from '@/lib/kz-phone'
import { ensureProfilePhone } from '@/lib/profile-sync'
import {
  getActivationLinkByToken,
  precheckActivationLink,
} from '@/lib/activation-links'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeLog } from '@/lib/safe-logger'
import { getFallbackByContext, getUserFacingError, logServerError } from '@/lib/safe-errors'
import type { EmailOtpType } from '@supabase/supabase-js'

const WA_CHALLENGE_CODE_HASH_COOKIE = 'wa_challenge_code_hash'
const WA_CHALLENGE_TOKEN_HASH_COOKIE = 'wa_challenge_token_hash'
const WA_CHALLENGE_VERIFY_TYPE_COOKIE = 'wa_challenge_verify_type'
const WA_CHALLENGE_PHONE_COOKIE = 'wa_challenge_phone'

type VerifyWhatsAppCodeResult = {
  ok: boolean
  error?: string
  userId?: string
}

type SendWhatsAppLoginResult = {
  ok: boolean
  message?: string
  error?: string
  /**
   * Распознаваемый код ошибки для UI. Сейчас единственное значение —
   * 'no_account': пользователя с таким номером не существует, и нет
   * валидной ссылки активации. UI должен показать CTA «Оформить подписку»
   * вместо OTP-формы.
   */
  code?: 'no_account'
}

/**
 * Проверяет, разрешено ли создавать новый auth-аккаунт для данного телефона
 * в рамках текущего запроса. Возвращает true ТОЛЬКО при наличии активной
 * ссылки активации, чей phone_target совпадает с поданным номером.
 *
 * Этот гейт исключает создание аккаунтов вне флоу активации. URL-параметр
 * activation_token принимается, но НЕ доверяется: всё перепроверяется по БД.
 */
async function isActivationSignupAllowed(args: {
  rawToken: string | null | undefined
  phoneE164: string
}): Promise<boolean> {
  const token = typeof args.rawToken === 'string' ? args.rawToken.trim() : ''
  if (!token) return false

  const row = await getActivationLinkByToken(token)
  if (!row) return false

  const pre = precheckActivationLink(row)
  if (pre.kind !== 'ok') return false

  const targetE164 = normalizePhoneToE164(row.phone_target)
  if (!targetE164) return false

  return targetE164 === args.phoneE164
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function hashCode(code: string) {
  const secret = getRequiredEnv('WHATSAPP_LOGIN_CODE_SECRET')
  return createHash('sha256')
    .update(`${code}:${secret}`)
    .digest('hex')
}

function generateSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function isEmailOtpType(value: string): value is EmailOtpType {
  return [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ].includes(value)
}

async function setWhatsAppChallengeCookies({
  codeHash,
  tokenHash,
  verifyType,
  phoneE164,
}: {
  codeHash: string
  tokenHash: string
  verifyType: EmailOtpType
  phoneE164: string
}) {
  const cookieStore = await cookies()
  const commonOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  }

  cookieStore.set(WA_CHALLENGE_CODE_HASH_COOKIE, codeHash, commonOptions)
  cookieStore.set(WA_CHALLENGE_TOKEN_HASH_COOKIE, tokenHash, commonOptions)
  cookieStore.set(WA_CHALLENGE_VERIFY_TYPE_COOKIE, verifyType, commonOptions)
  // Store phone so verifyWhatsAppLoginCode can save it to profiles reliably,
  // regardless of what verifyOtp returns in user_metadata.
  cookieStore.set(WA_CHALLENGE_PHONE_COOKIE, phoneE164, commonOptions)
}

async function clearWhatsAppChallengeCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(WA_CHALLENGE_CODE_HASH_COOKIE)
  cookieStore.delete(WA_CHALLENGE_TOKEN_HASH_COOKIE)
  cookieStore.delete(WA_CHALLENGE_VERIFY_TYPE_COOKIE)
  cookieStore.delete(WA_CHALLENGE_PHONE_COOKIE)
}


export async function sendWhatsAppLogin(
  formData: FormData
): Promise<SendWhatsAppLoginResult> {
  const phoneRaw = String(formData.get('phone') || '').trim()
  const phone = normalizeToE164Like(phoneRaw)
  const activationTokenRaw = String(formData.get('activation_token') || '').trim()

  if (!phone) {
    return {
      ok: false,
      error: 'Введите корректный номер телефона (с кодом страны, например +7…).',
    }
  }

  try {
    // Контекст B (регистрация под валидной ссылкой активации) определяется
    // только серверной перепроверкой токена + сверкой phone_target.
    // URL-параметр сам по себе не доверяется.
    const allowCreate = await isActivationSignupAllowed({
      rawToken: activationTokenRaw || null,
      phoneE164: phone,
    })

    const verificationCode = generateSixDigitCode()
    const { phoneE164, tokenHash, verifyType } =
      await createWhatsAppLoginChallenge(phone, { allowCreate })

    await sendWhatsAppVerificationCode({
      phoneE164,
      verificationCode,
    })

    await setWhatsAppChallengeCookies({
      codeHash: hashCode(verificationCode),
      tokenHash,
      verifyType,
      phoneE164,
    })

    return {
      ok: true,
      message: 'Мы отправили 6-значный код в WhatsApp.',
    }
  } catch (error) {
    if (error instanceof NoAccountError) {
      // Не логируем как ошибку — это ожидаемая ветка (попытка входа без подписки).
      return {
        ok: false,
        code: 'no_account',
        error: 'У вас ещё нет подписки Kudaclub.',
      }
    }

    logServerError('login/sendWhatsAppLogin', error)
    return {
      ok: false,
      error: getUserFacingError(error, getFallbackByContext('auth')),
    }
  }
}

export async function verifyWhatsAppLoginCode(
  formData: FormData
): Promise<VerifyWhatsAppCodeResult> {
  const inputCode = String(formData.get('code') || '').trim()
  if (!/^\d{6}$/.test(inputCode)) {
    return { ok: false, error: 'Введите корректный 6-значный код.' }
  }

  const cookieStore = await cookies()
  const storedCodeHash = cookieStore.get(WA_CHALLENGE_CODE_HASH_COOKIE)?.value
  const tokenHash = cookieStore.get(WA_CHALLENGE_TOKEN_HASH_COOKIE)?.value
  const verifyTypeRaw = cookieStore.get(WA_CHALLENGE_VERIFY_TYPE_COOKIE)?.value
  // Phone stored at challenge creation — guaranteed to be the exact E.164 number
  // the user entered, regardless of what verifyOtp returns.
  const phoneFromCookie = cookieStore.get(WA_CHALLENGE_PHONE_COOKIE)?.value ?? null

  if (!storedCodeHash || !tokenHash || !verifyTypeRaw || !isEmailOtpType(verifyTypeRaw)) {
    return { ok: false, error: 'Код устарел. Запросите новый.' }
  }

  if (hashCode(inputCode) !== storedCodeHash) {
    return { ok: false, error: 'Неверный код.' }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: verifyTypeRaw,
  })

  if (error) {
    await clearWhatsAppChallengeCookies()
    return { ok: false, error: 'Не удалось подтвердить код. Запросите новый.' }
  }

  if (data.user?.id) {
    // auth.users.phone is always null (synthetic email auth, not Supabase Phone provider).
    // Use phone from cookie (set at challenge creation) as primary source;
    // fall back to user_metadata.phone_e164 for backward compatibility.
    const phoneE164 =
      phoneFromCookie ??
      (typeof data.user.user_metadata?.phone_e164 === 'string'
        ? data.user.user_metadata.phone_e164
        : null)

    safeLog.logAuth('verifyWhatsAppLoginCode', {
      userId: data.user.id,
      phone: phoneE164,
    })

    await ensureProfilePhone(data.user.id, phoneE164)
  } else {
    safeLog.warn('[verifyWhatsAppLoginCode] verifyOtp returned no user')
  }

  await clearWhatsAppChallengeCookies()
  return { ok: true, userId: data.user?.id }
}
