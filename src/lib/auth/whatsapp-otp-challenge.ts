// src/lib/auth/whatsapp-otp-challenge.ts
// Общие хелперы WhatsApp-OTP challenge: cookie-хранилище одноразового кода и
// параметров верификации. Используются и во «Входе» (src/app/login/actions.ts),
// и в чекауте подписки (src/lib/checkout/otp-actions.ts), чтобы verifyOtp
// работал одинаково для обоих флоу (общие имена cookie + один алгоритм хэша).

import { createHash, randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'

export const WA_CHALLENGE_CODE_HASH_COOKIE = 'wa_challenge_code_hash'
export const WA_CHALLENGE_TOKEN_HASH_COOKIE = 'wa_challenge_token_hash'
export const WA_CHALLENGE_VERIFY_TYPE_COOKIE = 'wa_challenge_verify_type'
export const WA_CHALLENGE_PHONE_COOKIE = 'wa_challenge_phone'

export function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export function hashCode(code: string) {
  const secret = getRequiredEnv('WHATSAPP_LOGIN_CODE_SECRET')
  return createHash('sha256')
    .update(`${code}:${secret}`)
    .digest('hex')
}

export function generateSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function isEmailOtpType(value: string): value is EmailOtpType {
  return [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ].includes(value)
}

export async function setWhatsAppChallengeCookies({
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
  // Store phone so verify can save it to profiles reliably, regardless of what
  // verifyOtp returns in user_metadata.
  cookieStore.set(WA_CHALLENGE_PHONE_COOKIE, phoneE164, commonOptions)
}

export async function clearWhatsAppChallengeCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(WA_CHALLENGE_CODE_HASH_COOKIE)
  cookieStore.delete(WA_CHALLENGE_TOKEN_HASH_COOKIE)
  cookieStore.delete(WA_CHALLENGE_VERIFY_TYPE_COOKIE)
  cookieStore.delete(WA_CHALLENGE_PHONE_COOKIE)
}
