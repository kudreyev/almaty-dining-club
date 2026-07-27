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

type SubRow = {
  id: string
  end_date: string | null
  tiptop_subscription_id: string | null
}

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
        .select('id, end_date, tiptop_subscription_id')
        .eq('tiptop_subscription_id', subscriptionId)
        .limit(1)
        .maybeSingle<SubRow>()
      subRow = data ?? null
    }

    if (!subRow && accountId) {
      const { data } = await admin
        .from('subscriptions')
        .select('id, end_date, tiptop_subscription_id')
        .eq('user_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<SubRow>()
      subRow = data ?? null
    }

    if (subRow) {
      // Recurrent — основной надёжный источник ID подписки (p.Id). Пишем его
      // идемпотентно: только если он есть и ещё не заполнен у нас.
      const idPatch =
        subscriptionId && !subRow.tiptop_subscription_id
          ? { tiptop_subscription_id: subscriptionId }
          : {}

      if (status === 'Active') {
        await admin
          .from('subscriptions')
          .update({ status: 'active', ...idPatch })
          .eq('id', subRow.id)
      } else if (
        status === 'Cancelled' ||
        status === 'Rejected' ||
        status === 'Expired'
      ) {
        // Автосписаний больше не будет. Доступ оставляем до конца оплаченного
        // периода → статус 'cancelled' (страховка, если отмена пришла из кабинета
        // TipTop Pay или клиент отменил через my.tiptoppay.kz). Если период уже
        // истёк — доступа нет → 'inactive'.
        const today = new Date().toISOString().slice(0, 10)
        const periodEnded = !subRow.end_date || subRow.end_date < today
        await admin
          .from('subscriptions')
          .update({ status: periodEnded ? 'inactive' : 'cancelled', ...idPatch })
          .eq('id', subRow.id)
      } else if (Object.keys(idPatch).length > 0) {
        // PastDue и прочие статусы: доступ/статус не трогаем, но ID всё равно
        // сохраняем, если он ещё не записан.
        await admin.from('subscriptions').update(idPatch).eq('id', subRow.id)
      }
    }
  } catch (error) {
    logServerError('api/tiptoppay/recurrent', error)
    return NextResponse.json({ code: 13 }, { status: 500 })
  }

  return NextResponse.json({ code: 0 })
}
