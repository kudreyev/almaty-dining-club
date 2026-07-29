/**
 * Analytics ledger: subscribers + payments (источник правды для /admin/analytics).
 * Пишется из TipTop webhooks. Не управляет продуктовым доступом (subscriptions).
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  hasAnyUtm,
  parseUtmFromJsonData,
  type UtmAttribution,
} from '@/lib/utm'

export type SubscriberStatus = 'active' | 'cancelled' | 'past_due'

export type SubscriberRow = {
  id: string
  ttp_account_id: string
  email: string | null
  phone: string | null
  status: SubscriberStatus
  subscribed_at: string
  cancelled_at: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  promo_code: string | null
}

export type PaymentRecordResult = {
  paymentId: string
  subscriber: SubscriberRow
  /** true если строка payments уже была (повтор вебхука). */
  duplicate: boolean
  /** true если подписчик только что создан. */
  created: boolean
  /** true если статус сменился на active с non-active. */
  reactivated: boolean
}

function admin() {
  return createSupabaseAdminClient()
}

function coalesceAttribution(
  existing: Pick<
    SubscriberRow,
    'utm_source' | 'utm_medium' | 'utm_campaign' | 'promo_code'
  >,
  incoming: UtmAttribution,
): UtmAttribution {
  // Первая атрибуция побеждает: не перетираем UTM на рекуррентах.
  return {
    utm_source: existing.utm_source ?? incoming.utm_source,
    utm_medium: existing.utm_medium ?? incoming.utm_medium,
    utm_campaign: existing.utm_campaign ?? incoming.utm_campaign,
    promo_code: existing.promo_code ?? incoming.promo_code,
  }
}

export async function countActiveSubscribers(): Promise<number> {
  const { count, error } = await admin()
    .from('subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  if (error) throw error
  return count ?? 0
}

/**
 * Успешный платёж: upsert subscriber(active) + insert payment(success).
 * Идемпотентность по ttp_transaction_id.
 */
export async function recordSuccessfulPayment(args: {
  ttpAccountId: string
  ttpTransactionId: string
  amount: number
  email?: string | null
  phone?: string | null
  jsonData?: unknown
  rawPayload: Record<string, string>
}): Promise<PaymentRecordResult> {
  const db = admin()
  const attribution = parseUtmFromJsonData(args.jsonData)

  // Идемпотентность: уже есть платёж с этим TransactionId.
  const { data: existingPayment } = await db
    .from('payments')
    .select('id, subscriber_id')
    .eq('ttp_transaction_id', args.ttpTransactionId)
    .maybeSingle<{ id: string; subscriber_id: string }>()

  if (existingPayment) {
    const { data: sub, error } = await db
      .from('subscribers')
      .select('*')
      .eq('id', existingPayment.subscriber_id)
      .single<SubscriberRow>()
    if (error) throw error
    return {
      paymentId: existingPayment.id,
      subscriber: sub,
      duplicate: true,
      created: false,
      reactivated: false,
    }
  }

  const { data: existingSub } = await db
    .from('subscribers')
    .select('*')
    .eq('ttp_account_id', args.ttpAccountId)
    .maybeSingle<SubscriberRow>()

  let subscriber: SubscriberRow
  let created = false
  let reactivated = false

  if (existingSub) {
    const wasActive = existingSub.status === 'active'
    const attr = coalesceAttribution(existingSub, attribution)
    const patch: Record<string, unknown> = {
      status: 'active',
      cancelled_at: null,
      updated_at: new Date().toISOString(),
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
      promo_code: attr.promo_code,
    }
    if (args.email) patch.email = args.email
    if (args.phone) patch.phone = args.phone
    if (!wasActive) {
      reactivated = true
      // Новая «жизнь» подписки — обновляем subscribed_at при возврате.
      patch.subscribed_at = new Date().toISOString()
    }

    const { data, error } = await db
      .from('subscribers')
      .update(patch)
      .eq('id', existingSub.id)
      .select('*')
      .single<SubscriberRow>()
    if (error) throw error
    subscriber = data
  } else {
    created = true
    const insertRow = {
      ttp_account_id: args.ttpAccountId,
      email: args.email ?? null,
      phone: args.phone ?? null,
      status: 'active' as const,
      subscribed_at: new Date().toISOString(),
      cancelled_at: null,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      promo_code: attribution.promo_code,
    }
    const { data, error } = await db
      .from('subscribers')
      .insert(insertRow)
      .select('*')
      .single<SubscriberRow>()
    if (error) throw error
    subscriber = data
  }

  const { data: payment, error: payErr } = await db
    .from('payments')
    .insert({
      subscriber_id: subscriber.id,
      ttp_transaction_id: args.ttpTransactionId,
      amount: args.amount,
      status: 'success',
      raw_json: args.rawPayload,
    })
    .select('id')
    .single<{ id: string }>()

  // Гонка: повторная доставка между check и insert — unique violation.
  if (payErr) {
    if (payErr.code === '23505') {
      const { data: dup } = await db
        .from('payments')
        .select('id')
        .eq('ttp_transaction_id', args.ttpTransactionId)
        .single<{ id: string }>()
      return {
        paymentId: dup!.id,
        subscriber,
        duplicate: true,
        created: false,
        reactivated: false,
      }
    }
    throw payErr
  }

  return {
    paymentId: payment.id,
    subscriber,
    duplicate: false,
    created,
    reactivated,
  }
}

/**
 * Неуспешный платёж: payment(fail). Subscriber создаём при необходимости,
 * статус не трогаем (TipTop сам отменит после N ретраев → recurrent).
 */
export async function recordFailedPayment(args: {
  ttpAccountId: string
  ttpTransactionId: string
  amount: number
  email?: string | null
  phone?: string | null
  jsonData?: unknown
  rawPayload: Record<string, string>
}): Promise<{ paymentId: string; duplicate: boolean }> {
  const db = admin()

  const { data: existingPayment } = await db
    .from('payments')
    .select('id')
    .eq('ttp_transaction_id', args.ttpTransactionId)
    .maybeSingle<{ id: string }>()

  if (existingPayment) {
    return { paymentId: existingPayment.id, duplicate: true }
  }

  let subscriberId: string
  const { data: existingSub } = await db
    .from('subscribers')
    .select('id')
    .eq('ttp_account_id', args.ttpAccountId)
    .maybeSingle<{ id: string }>()

  if (existingSub) {
    subscriberId = existingSub.id
  } else {
    const attribution = parseUtmFromJsonData(args.jsonData)
    const { data, error } = await db
      .from('subscribers')
      .insert({
        ttp_account_id: args.ttpAccountId,
        email: args.email ?? null,
        phone: args.phone ?? null,
        status: 'past_due',
        subscribed_at: new Date().toISOString(),
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        promo_code: attribution.promo_code,
      })
      .select('id')
      .single<{ id: string }>()
    if (error) throw error
    subscriberId = data.id
  }

  const { data: payment, error: payErr } = await db
    .from('payments')
    .insert({
      subscriber_id: subscriberId,
      ttp_transaction_id: args.ttpTransactionId,
      amount: args.amount,
      status: 'fail',
      raw_json: args.rawPayload,
    })
    .select('id')
    .single<{ id: string }>()

  if (payErr) {
    if (payErr.code === '23505') {
      const { data: dup } = await db
        .from('payments')
        .select('id')
        .eq('ttp_transaction_id', args.ttpTransactionId)
        .single<{ id: string }>()
      return { paymentId: dup!.id, duplicate: true }
    }
    throw payErr
  }

  return { paymentId: payment.id, duplicate: false }
}

export type RecurrentUpdateResult = {
  subscriber: SubscriberRow | null
  changed: boolean
  cancelled: boolean
}

/** Изменение статуса подписки из Recurrent-уведомления. */
export async function applyRecurrentStatus(args: {
  ttpAccountId: string | null
  ttpSubscriptionId?: string | null
  status: string
  reason?: string | null
  jsonData?: unknown
}): Promise<RecurrentUpdateResult> {
  const db = admin()
  if (!args.ttpAccountId) {
    return { subscriber: null, changed: false, cancelled: false }
  }

  const { data: existing } = await db
    .from('subscribers')
    .select('*')
    .eq('ttp_account_id', args.ttpAccountId)
    .maybeSingle<SubscriberRow>()

  if (!existing) {
    // Cancelled без предварительного pay — создаём запись cancelled.
    if (args.status === 'Cancelled' || args.status === 'Rejected') {
      const attribution = parseUtmFromJsonData(args.jsonData)
      const { data, error } = await db
        .from('subscribers')
        .insert({
          ttp_account_id: args.ttpAccountId,
          status: 'cancelled',
          subscribed_at: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
          utm_source: attribution.utm_source,
          utm_medium: attribution.utm_medium,
          utm_campaign: attribution.utm_campaign,
          promo_code: attribution.promo_code,
        })
        .select('*')
        .single<SubscriberRow>()
      if (error) throw error
      return { subscriber: data, changed: true, cancelled: true }
    }
    return { subscriber: null, changed: false, cancelled: false }
  }

  if (args.status === 'Active') {
    if (existing.status === 'active') {
      return { subscriber: existing, changed: false, cancelled: false }
    }
    const { data, error } = await db
      .from('subscribers')
      .update({
        status: 'active',
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single<SubscriberRow>()
    if (error) throw error
    return { subscriber: data, changed: true, cancelled: false }
  }

  if (args.status === 'PastDue') {
    if (existing.status === 'past_due') {
      return { subscriber: existing, changed: false, cancelled: false }
    }
    const { data, error } = await db
      .from('subscribers')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single<SubscriberRow>()
    if (error) throw error
    return { subscriber: data, changed: true, cancelled: false }
  }

  if (
    args.status === 'Cancelled' ||
    args.status === 'Rejected' ||
    args.status === 'Expired'
  ) {
    if (existing.status === 'cancelled') {
      return { subscriber: existing, changed: false, cancelled: false }
    }
    const { data, error } = await db
      .from('subscribers')
      .update({
        status: 'cancelled',
        cancelled_at: existing.cancelled_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single<SubscriberRow>()
    if (error) throw error
    return { subscriber: data, changed: true, cancelled: true }
  }

  return { subscriber: existing, changed: false, cancelled: false }
}

export function attributionLabel(sub: Pick<SubscriberRow, 'utm_source'>): string {
  return sub.utm_source?.trim() || 'direct'
}

export function isPaidMedium(utmMedium: string | null | undefined): boolean {
  if (!utmMedium) return false
  return utmMedium.trim().toLowerCase() === 'paid'
}

/** Для тестов/отладки: есть ли хоть какая-то атрибуция. */
export { hasAnyUtm }
