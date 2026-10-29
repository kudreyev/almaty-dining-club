// src/lib/tiptoppay.ts
// Проверка вебхуков TipTop Pay. Оплаты отключены: модуль нужен только чтобы
// отличать настоящие уведомления от мусора в журнале.
// ВНИМАНИЕ: только сервер — читает TIPTOPPAY_API_SECRET.

import crypto from 'crypto'

// TipTop Pay подписывает тело запроса: Content-HMAC = base64(HMAC-SHA256(rawBody, API_SECRET))
export function verifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false
  const secret = process.env.TIPTOPPAY_API_SECRET
  if (!secret) return false
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader))
  } catch {
    return false
  }
}

// Вебхуки приходят как application/x-www-form-urlencoded
export function parseWebhookBody(rawBody: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(rawBody))
}
