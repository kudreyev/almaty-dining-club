// src/lib/tiptoppay.ts
// Серверные утилиты для TipTop Pay: проверка вебхуков + API подписок.
// ВНИМАНИЕ: этот модуль работает только на сервере — он читает
// TIPTOPPAY_API_SECRET. Никогда не импортируйте его в клиентские компоненты.

import crypto from 'crypto'

const API_BASE = 'https://api.tiptoppay.kz'

// --- Проверка подлинности вебхука ---
// TipTop Pay подписывает тело запроса: Content-HMAC = base64(HMAC-SHA256(rawBody, API_SECRET))
export function verifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false
  const secret = process.env.TIPTOPPAY_API_SECRET
  if (!secret) throw new Error('TIPTOPPAY_API_SECRET is not set')
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

// --- API-клиент (Basic Auth: PublicId + API Secret) ---
async function apiCall<T = unknown>(path: string, body: object): Promise<T> {
  const publicId = process.env.TIPTOPPAY_PUBLIC_ID
  const secret = process.env.TIPTOPPAY_API_SECRET
  if (!publicId || !secret) throw new Error('TipTop Pay credentials are not set')

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${publicId}:${secret}`).toString('base64')}`,
      'X-Request-ID': crypto.randomUUID(), // идемпотентность
    },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

// Найти подписки пользователя
export const findSubscriptions = (accountId: string) =>
  apiCall('/subscriptions/find', { accountId })

// Информация о подписке
export const getSubscription = (Id: string) => apiCall('/subscriptions/get', { Id })

// Отменить подписку (кнопка «Отменить подписку» в личном кабинете пользователя)
export const cancelSubscription = (Id: string) => apiCall('/subscriptions/cancel', { Id })

// Изменить подписку (сумма, дата следующего списания и т.п.)
export const updateSubscription = (params: {
  Id: string
  Amount?: number
  NextTransactionDate?: string
}) => apiCall('/subscriptions/update', params)
