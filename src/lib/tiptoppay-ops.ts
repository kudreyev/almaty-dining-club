// src/lib/tiptoppay-ops.ts
// Операционные хелперы TipTop Pay для админ-дашборда.
// Server-only: читает TIPTOPPAY_PUBLIC_ID / TIPTOPPAY_API_SECRET.

import crypto from 'crypto'

const API_BASE = 'https://api.tiptoppay.kz'
export const TIPTOP_MERCHANT_URL = 'https://merchant.tiptoppay.kz/'

export type TipTopPaymentRow = {
  TransactionId: number
  Status: string
  AccountId: string | null
  Amount: number
  CardType: string | null
  ApplePay: boolean | null
  GooglePay: boolean | null
  Token: string | null
  SubscriptionId: string | null
  CreatedDateIso: string | null
}

type PaymentsListResponse = {
  Success?: boolean
  Message?: string | null
  Model?: TipTopPaymentRow[] | null
}

async function apiCall<T>(path: string, body: object): Promise<T> {
  const publicId = process.env.TIPTOPPAY_PUBLIC_ID
  const secret = process.env.TIPTOPPAY_API_SECRET
  if (!publicId || !secret) throw new Error('TipTop Pay credentials are not set')

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${publicId}:${secret}`).toString('base64')}`,
      'X-Request-ID': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

function toDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Платежи за один календарный день (UTC date string YYYY-MM-DD). */
export async function listPaymentsByDate(date: string): Promise<TipTopPaymentRow[]> {
  const data = await apiCall<PaymentsListResponse>('/payments/list', { Date: date })
  if (!data.Success) {
    throw new Error(data.Message ?? `TipTop payments/list failed for ${date}`)
  }
  return data.Model ?? []
}

/** Платежи за последние N календарных дней (включая сегодня). */
export async function listRecentPayments(days: number): Promise<TipTopPaymentRow[]> {
  const out: TipTopPaymentRow[] = []
  const seen = new Set<number>()
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const rows = await listPaymentsByDate(toDateYmd(d))
    for (const row of rows) {
      if (seen.has(row.TransactionId)) continue
      seen.add(row.TransactionId)
      out.push(row)
    }
  }
  out.sort((a, b) => {
    const ta = a.CreatedDateIso ?? ''
    const tb = b.CreatedDateIso ?? ''
    return tb.localeCompare(ta)
  })
  return out
}

/**
 * Успешные платежи без рекуррента: нет Token и нет SubscriptionId.
 * Типичный кейс — Mastercard + Apple Pay (эквайер не выдаёт токен).
 */
export function paymentsWithoutRecurrent(
  payments: TipTopPaymentRow[],
): TipTopPaymentRow[] {
  return payments.filter(
    (p) =>
      p.Status === 'Completed' &&
      !p.Token &&
      !p.SubscriptionId,
  )
}

/** Ссылка в кабинет TipTop (deep-link по txn нестабилен — открываем портал). */
export function merchantPortalUrl(): string {
  return TIPTOP_MERCHANT_URL
}
