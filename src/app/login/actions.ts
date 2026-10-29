'use server'

import { cookies } from 'next/headers'
import {
  createWhatsAppLoginChallenge,
  normalizePhoneToE164,
  sendWhatsAppVerificationCode,
} from '@/lib/auth/whatsapp-login'
import {
  WA_CHALLENGE_CODE_HASH_COOKIE,
  WA_CHALLENGE_TOKEN_HASH_COOKIE,
  WA_CHALLENGE_VERIFY_TYPE_COOKIE,
  WA_CHALLENGE_PHONE_COOKIE,
  clearWhatsAppChallengeCookies,
  generateSixDigitCode,
  hashCode,
  isEmailOtpType,
  setWhatsAppChallengeCookies,
} from '@/lib/auth/whatsapp-otp-challenge'
import { isLoginOtpAllowed, recordLoginOtpSend } from '@/lib/auth/otp-rate-limit'
import { normalizeToE164Like } from '@/lib/kz-phone'
import { ensureProfilePhone } from '@/lib/profile-sync'
import { logAnalyticsEvent } from '@/lib/analytics'
import { parseUtmCookieValue, UTM_COOKIE_NAME } from '@/lib/utm'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeLog } from '@/lib/safe-logger'
import { getFallbackByContext, getUserFacingError, logServerError } from '@/lib/safe-errors'

type VerifyWhatsAppCodeResult = {
  ok: boolean
  error?: string
  userId?: string
  /** Первое подтверждение номера — регистрация завершена. */
  isNewUser?: boolean
}

type SendWhatsAppLoginResult = {
  ok: boolean
  message?: string
  error?: string
}

export async function sendWhatsAppLogin(
  formData: FormData
): Promise<SendWhatsAppLoginResult> {
  const phoneRaw = String(formData.get('phone') || '').trim()
  const phone = normalizePhoneToE164(normalizeToE164Like(phoneRaw) ?? '')

  if (!phone) {
    return {
      ok: false,
      error: 'Введите корректный номер телефона (с кодом страны, например +7…).',
    }
  }

  if (!(await isLoginOtpAllowed(phone))) {
    return {
      ok: false,
      error: 'Слишком много попыток. Подождите несколько минут и запросите код снова.',
    }
  }

  try {
    const verificationCode = generateSixDigitCode()
    const { phoneE164, tokenHash, verifyType } = await createWhatsAppLoginChallenge(phone)

    await sendWhatsAppVerificationCode({
      phoneE164,
      verificationCode,
    })
    await recordLoginOtpSend(phoneE164)

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

  let isNewUser = false

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

    const { firstVerification } = await ensureProfilePhone(data.user.id, phoneE164)
    isNewUser = firstVerification

    if (firstVerification) {
      const utm = parseUtmCookieValue(cookieStore.get(UTM_COOKIE_NAME)?.value)
      await logAnalyticsEvent({
        event_name: 'signup_completed',
        user_id: data.user.id,
        meta: Object.fromEntries(Object.entries(utm).filter(([, v]) => v != null)),
      })
    }
  } else {
    safeLog.warn('[verifyWhatsAppLoginCode] verifyOtp returned no user')
  }

  await clearWhatsAppChallengeCookies()
  return { ok: true, userId: data.user?.id, isNewUser }
}
