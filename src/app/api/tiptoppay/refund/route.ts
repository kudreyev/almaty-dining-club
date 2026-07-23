// src/app/api/tiptoppay/refund/route.ts
// Refund-уведомление: приходит при возврате платежа (полном или частичном).
// В отличие от обычной отмены подписки на сайте (доступ до конца оплаченного
// периода), возврат закрывает доступ НЕМЕДЛЕННО: деньги вернулись — доступа нет.

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyWebhook,
  parseWebhookBody,
  cancelSubscription,
} from '@/lib/tiptoppay'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'
import { safeLog } from '@/lib/safe-logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SubRow = { id: string; tiptop_subscription_id: string | null }

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  // Ключевые поля:
  // p.TransactionId          — ID транзакции возврата
  // p.OriginalTransactionId  — ID исходного (возвращаемого) платежа
  // p.AccountId              — ID нашего пользователя (auth.users.id)
  // p.Amount                 — сумма возврата
  const transactionId = p.TransactionId || null
  const originalTransactionId = p.OriginalTransactionId || null
  const accountId = p.AccountId
  const amount = p.Amount || null

  // Возврат — событие, которое мы всегда подтверждаем (code 0), даже если не
  // смогли что-то сделать: TipTop Pay иначе будет слать уведомление повторно.
  if (!accountId || !UUID_RE.test(accountId)) {
    logServerError(
      'api/tiptoppay/refund',
      new Error(`invalid AccountId: ${accountId}`),
    )
    return NextResponse.json({ code: 0 })
  }

  try {
    const admin = createSupabaseAdminClient()

    // Берём последнюю подписку пользователя — нужен её id и tiptop_subscription_id.
    const { data } = await admin
      .from('subscriptions')
      .select('id, tiptop_subscription_id')
      .eq('user_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubRow>()
    const subRow = data ?? null

    if (subRow) {
      // Немедленно закрываем доступ: статус inactive + paidUntil = сегодня.
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await admin
        .from('subscriptions')
        .update({ status: 'inactive', end_date: today })
        .eq('id', subRow.id)
      if (error) throw error

      // Останавливаем будущие списания на случай, если оператор оформил возврат,
      // но забыл отменить рекуррент в кабинете. Если подписка уже отменена —
      // API вернёт ошибку, это нормально: возврат всё равно обработан.
      if (subRow.tiptop_subscription_id) {
        try {
          await cancelSubscription(subRow.tiptop_subscription_id)
        } catch (cancelError) {
          logServerError('api/tiptoppay/refund:cancel', cancelError)
        }
      }
    }

    safeLog.info('[api/tiptoppay/refund] processed', {
      user_id: accountId,
      transactionId,
      originalTransactionId,
      amount,
      subscriptionFound: Boolean(subRow),
    })
  } catch (error) {
    // Не роняем обработку ненулевым кодом — иначе TipTop Pay будет ретраить.
    logServerError('api/tiptoppay/refund', error)
  }

  return NextResponse.json({ code: 0 })
}
