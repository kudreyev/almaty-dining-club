'use server'

import { createHash, randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import {
  createWhatsAppLoginChallenge,
  sendWhatsAppVerificationCode,
} from '@/lib/auth/whatsapp-login'
import { normalizeToE164Like } from '@/lib/kz-phone'
import { ensureProfilePhone } from '@/lib/profile-sync'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

const WA_CHALLENGE_CODE_HASH_COOKIE = 'wa_challenge_code_hash'
const WA_CHALLENGE_TOKEN_HASH_COOKIE = 'wa_challenge_token_hash'
const WA_CHALLENGE_VERIFY_TYPE_COOKIE = 'wa_challenge_verify_type'
const WA_CHALLENGE_PHONE_COOKIE = 'wa_challenge_phone'

type VerifyWhatsAppCodeResult = {
  ok: boolean
  error?: string
}

type SendWhatsAppLoginResult = {
  ok: boolean
  message?: string
  error?: string
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

  if (!phone) {
    return {
      ok: false,
      error: 'Введите корректный номер телефона (с кодом страны, например +7…).',
    }
  }

  try {
    const verificationCode = generateSixDigitCode()
    const { phoneE164, tokenHash, verifyType } =
      await createWhatsAppLoginChallenge(phone)

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
    const text = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return {
      ok: false,
      error: text,
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

    console.log('[verifyWhatsAppLoginCode] user.id:', data.user.id)
    console.log('[verifyWhatsAppLoginCode] phoneFromCookie:', phoneFromCookie)
    console.log('[verifyWhatsAppLoginCode] user_metadata:', JSON.stringify(data.user.user_metadata))
    console.log('[verifyWhatsAppLoginCode] phoneE164 resolved:', phoneE164)

    await ensureProfilePhone(data.user.id, phoneE164)
    console.log('[verifyWhatsAppLoginCode] ensureProfilePhone done')
  } else {
    console.warn('[verifyWhatsAppLoginCode] verifyOtp returned no user:', JSON.stringify(data))
  }

  await clearWhatsAppChallengeCookies()
  return { ok: true }
}
