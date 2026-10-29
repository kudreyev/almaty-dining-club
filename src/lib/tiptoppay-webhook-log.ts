// Оплаты отключены: вебхуки TipTop Pay только журналируются и подтверждаются
// ответом {"code":0}, чтобы TipTop не ретраил. Подписки и доступ не меняются.
// Если пришло реальное списание — алерт в Telegram (нужен возврат и отмена подписки).

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { parseWebhookBody, verifyWebhook } from '@/lib/tiptoppay'
import { sendTelegramMessage } from '@/lib/telegram'
import { safeLog } from '@/lib/safe-logger'

export type TipTopWebhookKind = 'pay' | 'recurrent' | 'fail' | 'refund'

// Без карточных данных, email и токенов.
const SAFE_FIELDS = [
  'TransactionId',
  'Amount',
  'Currency',
  'Status',
  'OperationType',
  'InvoiceId',
  'AccountId',
  'SubscriptionId',
  'Id',
  'Reason',
  'ReasonCode',
  'DateTime',
] as const

function pickSafeFields(payload: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of SAFE_FIELDS) {
    const value = payload[key]
    if (typeof value === 'string' && value) out[key] = value.slice(0, 120)
  }
  return out
}

function isRealCharge(kind: TipTopWebhookKind, fields: Record<string, string>): boolean {
  if (kind !== 'pay') return false
  const amount = Number(String(fields.Amount ?? '').replace(',', '.'))
  return Number.isFinite(amount) && amount > 0
}

export async function logTipTopWebhook(
  req: NextRequest,
  kind: TipTopWebhookKind,
): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    const verified = verifyWebhook(rawBody, req.headers.get('Content-HMAC'))
    const fields = pickSafeFields(parseWebhookBody(rawBody))

    safeLog.warn(`[tiptop-webhook:${kind}] payments are disabled, ignored`, {
      verified,
      ...fields,
    })

    try {
      await createSupabaseAdminClient()
        .from('analytics_events')
        .insert({
          event_name: 'tiptop_webhook_ignored',
          meta: { kind, verified, ...fields },
        })
    } catch (error) {
      safeLog.error('[tiptop-webhook] audit insert failed', error)
    }

    if (verified && isRealCharge(kind, fields)) {
      await sendTelegramMessage(
        [
          '⚠️ TipTop: прошло списание, хотя оплаты отключены.',
          `Сумма: ${fields.Amount ?? '?'} ${fields.Currency ?? ''}`.trim(),
          fields.SubscriptionId ? `Подписка: ${fields.SubscriptionId}` : null,
          fields.TransactionId ? `Транзакция: ${fields.TransactionId}` : null,
          'Сделайте возврат и запустите cancel-all-subscriptions.',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    }
  } catch (error) {
    safeLog.error(`[tiptop-webhook:${kind}] failed to log`, error)
  }

  return NextResponse.json({ code: 0 })
}
