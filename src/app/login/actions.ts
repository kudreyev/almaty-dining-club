'use server'

import { sendWhatsAppLoginMessage } from '@/lib/auth/whatsapp-login'
import type { EmailOtpType } from '@supabase/supabase-js'

type SendWhatsAppLoginResult = {
  ok: boolean
  message?: string
  error?: string
  pendingEmail?: string
  verifyType?: EmailOtpType
}

export async function sendWhatsAppLogin(
  formData: FormData
): Promise<SendWhatsAppLoginResult> {
  const phone = String(formData.get('phone') || '').trim()

  if (!phone) {
    return {
      ok: false,
      error: 'Введите номер телефона.',
    }
  }

  try {
    const { email, verifyType } = await sendWhatsAppLoginMessage(phone)

    return {
      ok: true,
      message: 'Мы отправили 6-значный код в WhatsApp.',
      pendingEmail: email,
      verifyType,
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return {
      ok: false,
      error: text,
    }
  }
}
