'use server'

// src/lib/checkout/otp-actions.ts
// Отправка WhatsApp-OTP для чекаута подписки.
// В отличие от «Входа», здесь разрешена самрегистрация: если аккаунта нет —
// он создаётся (allowCreate: true), потому что оплата и есть регистрация.
// Доступ к подписке при этом даёт ТОЛЬКО Pay-вебхук, не факт создания аккаунта.
// Проверка кода переиспользуется из login/actions (verifyWhatsAppLoginCode) —
// cookie challenge общие (см. lib/auth/whatsapp-otp-challenge.ts).

import {
  createWhatsAppLoginChallenge,
  sendWhatsAppVerificationCode,
} from '@/lib/auth/whatsapp-login'
import {
  generateSixDigitCode,
  hashCode,
  setWhatsAppChallengeCookies,
} from '@/lib/auth/whatsapp-otp-challenge'
import {
  isCheckoutOtpAllowed,
  recordCheckoutOtpSend,
} from '@/lib/checkout/otp-rate-limit'
import { normalizeToE164Like } from '@/lib/kz-phone'
import {
  getFallbackByContext,
  getUserFacingError,
  logServerError,
} from '@/lib/safe-errors'

type SendCheckoutOtpResult = {
  ok: boolean
  message?: string
  error?: string
}

export async function sendCheckoutOtp(
  formData: FormData
): Promise<SendCheckoutOtpResult> {
  const phoneRaw = String(formData.get('phone') || '').trim()
  const phone = normalizeToE164Like(phoneRaw)

  if (!phone) {
    return {
      ok: false,
      error: 'Введите корректный номер телефона (с кодом страны, например +7…).',
    }
  }

  const allowed = await isCheckoutOtpAllowed()
  if (!allowed) {
    return {
      ok: false,
      error: 'Слишком много попыток. Попробуйте позже.',
    }
  }

  try {
    const verificationCode = generateSixDigitCode()
    // allowCreate: true — создаём аккаунт по номеру прямо в чекауте.
    const { phoneE164, tokenHash, verifyType } =
      await createWhatsAppLoginChallenge(phone, { allowCreate: true })

    await sendWhatsAppVerificationCode({ phoneE164, verificationCode })

    await setWhatsAppChallengeCookies({
      codeHash: hashCode(verificationCode),
      tokenHash,
      verifyType,
      phoneE164,
    })

    await recordCheckoutOtpSend()

    return { ok: true, message: 'Мы отправили код в WhatsApp.' }
  } catch (error) {
    logServerError('checkout/sendCheckoutOtp', error)
    return {
      ok: false,
      error: getUserFacingError(error, getFallbackByContext('auth')),
    }
  }
}
