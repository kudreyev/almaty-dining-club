// src/app/api/tiptoppay/pay/route.ts
// Pay-уведомление: приходит после КАЖДОГО успешного платежа —
// и установочного (первая оплата через виджет), и каждого рекуррентного списания.
// Это единственный надёжный источник правды об оплате. Не активируйте подписку
// по коллбэку виджета на фронте — только здесь.

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  // Ключевые поля:
  // p.TransactionId  — ID транзакции
  // p.Amount         — сумма
  // p.Status         — Completed (для paymentSchema: Single)
  // p.AccountId      — ID нашего пользователя (мы передали его в userInfo.accountId)
  // p.SubscriptionId — ID подписки; есть у рекуррентных списаний и у установочного
  //                    платежа, создавшего подписку
  // p.TestMode       — "1" если тестовый платёж
  // p.Token          — токен карты (можно сохранить для «оплаты по клику»)

  const accountId = p.AccountId
  const subscriptionId = p.SubscriptionId || null
  const status = p.Status

  // Активируем доступ только по успешному платежу. Иные статусы просто
  // подтверждаем (code 0), чтобы TipTop Pay не слал повторно.
  if (status && status !== 'Completed' && status !== 'Authorized') {
    return NextResponse.json({ code: 0 })
  }

  // accountId должен быть валидным UUID пользователя (auth.users.id).
  // Иначе действий выполнить нельзя — логируем и подтверждаем.
  if (!accountId || !UUID_RE.test(accountId)) {
    logServerError('api/tiptoppay/pay', new Error(`invalid AccountId: ${accountId}`))
    return NextResponse.json({ code: 0 })
  }

  // paidUntil = сегодня + 1 месяц (месячная подписка). Храним как date в end_date,
  // а доступ проверяется существующей логикой isSubscriptionCurrentlyActive.
  const startDate = toDateString(new Date())
  const paidUntil = new Date()
  paidUntil.setMonth(paidUntil.getMonth() + 1)
  const endDate = toDateString(paidUntil)

  try {
    const admin = createSupabaseAdminClient()

    // Ищем существующую подписку: сначала по TipTop subscriptionId (идемпотентность
    // рекуррентных списаний), затем — последнюю по user_id.
    type SubRow = { id: string; tiptop_subscription_id: string | null }
    let subRow: SubRow | null = null

    if (subscriptionId) {
      const { data } = await admin
        .from('subscriptions')
        .select('id, tiptop_subscription_id')
        .eq('tiptop_subscription_id', subscriptionId)
        .limit(1)
        .maybeSingle<SubRow>()
      subRow = data ?? null
    }

    if (!subRow) {
      const { data } = await admin
        .from('subscriptions')
        .select('id, tiptop_subscription_id')
        .eq('user_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<SubRow>()
      subRow = data ?? null
    }

    const patch = {
      status: 'active' as const,
      plan_name: 'monthly_tiptoppay',
      plan_type: 'paid',
      start_date: startDate,
      end_date: endDate,
    }

    if (subRow) {
      // Идемпотентность: пишем tiptop_subscription_id только если он есть в
      // уведомлении и ещё не заполнен — не перезатираем существующий ID (в т.ч.
      // в NULL, когда установочный Pay пришёл без SubscriptionId).
      const idPatch =
        subscriptionId && !subRow.tiptop_subscription_id
          ? { tiptop_subscription_id: subscriptionId }
          : {}
      const { error } = await admin
        .from('subscriptions')
        .update({ ...patch, ...idPatch })
        .eq('id', subRow.id)
      if (error) throw error
    } else {
      const { error } = await admin
        .from('subscriptions')
        .insert({
          user_id: accountId,
          ...patch,
          tiptop_subscription_id: subscriptionId,
        })
      if (error) throw error
    }
  } catch (error) {
    logServerError('api/tiptoppay/pay', error)
    // Ненулевой код → TipTop Pay повторит уведомление (важно при временных сбоях БД).
    return NextResponse.json({ code: 13 }, { status: 500 })
  }

  // Обязательный ответ — иначе TipTop Pay будет слать уведомление повторно
  return NextResponse.json({ code: 0 })
}
