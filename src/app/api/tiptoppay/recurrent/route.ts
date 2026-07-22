// src/app/api/tiptoppay/recurrent/route.ts
// Recurrent-уведомление: приходит при изменении статуса подписки.
// Статусы: Active, PastDue (просрочка, идут повторные попытки),
// Cancelled (отменена), Rejected (не удалось списать), Expired (исчерпан maxPeriods).

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SubRow = { id: string; end_date: string | null }

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  // Ключевые поля:
  // p.Id                    — ID подписки (= SubscriptionId из Pay-уведомления)
  // p.AccountId             — ID нашего пользователя
  // p.Status                — новый статус подписки
  // p.NextTransactionDate   — дата следующего списания
  // p.SuccessfulTransactionsNumber / p.FailedTransactionsNumber

  const status = p.Status
  const accountId = p.AccountId
  const subscriptionId = p.Id || null

  try {
    const admin = createSupabaseAdminClient()

    // Находим нашу подписку: сначала по TipTop subscriptionId, затем по user_id.
    let subRow: SubRow | null = null

    if (subscriptionId) {
      const { data } = await admin
        .from('subscriptions')
        .select('id, end_date')
        .eq('tiptop_subscription_id', subscriptionId)
        .limit(1)
        .maybeSingle<SubRow>()
      subRow = data ?? null
    }

    if (!subRow && accountId) {
      const { data } = await admin
        .from('subscriptions')
        .select('id, end_date')
        .eq('user_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<SubRow>()
      subRow = data ?? null
    }

    if (subRow) {
      if (status === 'Active') {
        // Подтверждаем активность и фиксируем id подписки, если его ещё нет.
        await admin
          .from('subscriptions')
          .update({
            status: 'active',
            ...(subscriptionId ? { tiptop_subscription_id: subscriptionId } : {}),
          })
          .eq('id', subRow.id)
      } else if (
        status === 'Cancelled' ||
        status === 'Rejected' ||
        status === 'Expired'
      ) {
        // Доступ оставляем до конца оплаченного периода (end_date).
        // Если период уже истёк — помечаем подписку expired.
        const today = new Date().toISOString().slice(0, 10)
        if (!subRow.end_date || subRow.end_date < today) {
          await admin
            .from('subscriptions')
            .update({ status: 'expired' })
            .eq('id', subRow.id)
        }
      }
      // PastDue: доступ сохраняем (идут повторные попытки списания), статус не трогаем.
    }
  } catch (error) {
    logServerError('api/tiptoppay/recurrent', error)
    return NextResponse.json({ code: 13 }, { status: 500 })
  }

  return NextResponse.json({ code: 0 })
}
