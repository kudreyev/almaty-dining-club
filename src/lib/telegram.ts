import { logServerError } from '@/lib/safe-errors'

export type TelegramSendResult =
  | { sent: true }
  | { sent: false; reason: 'not_configured' | 'api_error'; detail?: string }

/** Отправка сообщения в Telegram-чат алертов. Best-effort, не бросает. */
export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    return { sent: false, reason: 'not_configured' }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      logServerError('telegram:sendMessage', new Error(`${res.status}: ${detail}`))
      return { sent: false, reason: 'api_error', detail }
    }

    return { sent: true }
  } catch (error) {
    logServerError('telegram:sendMessage', error)
    return { sent: false, reason: 'api_error' }
  }
}
