'use server'

import { sendWhatsAppLoginMessage } from '@/lib/auth/whatsapp-login'

type SendWhatsAppLoginResult = {
  ok: boolean
  message?: string
  error?: string
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
    await sendWhatsAppLoginMessage(phone)

    return {
      ok: true,
      message: 'Мы отправили ссылку для входа в WhatsApp.',
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return {
      ok: false,
      error: text,
    }
  }
}
