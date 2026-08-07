/**
 * Web Push (VAPID) — рядом с WhatsApp access-messaging.
 * subscriberId = profiles.id (залогиненный пользователь).
 */

import webpush from 'web-push'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'
import { safeLog } from '@/lib/safe-logger'

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  campaignId?: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  subscriber_id?: string
}

export const PUSH_SEND_BATCH_SIZE = 100

let vapidConfigured = false

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'mailto:ops@kudaclub.kz'

  if (!publicKey || !privateKey) {
    safeLog.warn('[push-messaging] VAPID keys missing — skip push')
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export function resolvePushUrl(url: string, campaignId?: string): string {
  const trimmed = url.trim() || '/'
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kudaclub.kz').replace(
    /\/$/,
    '',
  )
  const absolute = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${site}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`

  try {
    const parsed = new URL(absolute)
    if (campaignId) {
      parsed.searchParams.set('push_campaign', campaignId)
    }
    return parsed.href
  } catch {
    return absolute
  }
}

function isGoneStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}

async function deleteSubscriptionById(id: string): Promise<void> {
  const db = createSupabaseAdminClient()
  await db.from('push_subscriptions').delete().eq('id', id)
}

async function markSuccess(id: string): Promise<void> {
  const db = createSupabaseAdminClient()
  await db
    .from('push_subscriptions')
    .update({ last_success_at: new Date().toISOString() })
    .eq('id', id)
}

async function sendToRow(
  row: PushSubscriptionRow,
  payload: PushPayload,
): Promise<'ok' | 'gone' | 'error'> {
  try {
    const tag = payload.campaignId
      ? `campaign:${payload.campaignId}`
      : (payload.tag ?? 'kudaclub')

    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: resolvePushUrl(payload.url, payload.campaignId),
        tag,
        campaign_id: payload.campaignId ?? null,
      }),
      {
        TTL: 60 * 60 * 24,
        urgency: 'normal',
      },
    )
    await markSuccess(row.id)
    return 'ok'
  } catch (error) {
    const statusCode =
      typeof error === 'object' &&
      error &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : undefined

    if (isGoneStatus(statusCode)) {
      await deleteSubscriptionById(row.id)
      safeLog.info('[push-messaging] removed stale subscription', {
        id: row.id,
        statusCode,
      })
      return 'gone'
    }

    logServerError('push-messaging:send', error)
    return 'error'
  }
}

/**
 * Отправить web-push всем устройствам подписчика.
 * Протухшие endpoint (404/410) удаляются из БД.
 */
export async function sendPush(
  subscriberId: string,
  payload: PushPayload,
): Promise<{ sent: number; gone: number; failed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, gone: 0, failed: 0 }
  }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('subscriber_id', subscriberId)
    .returns<PushSubscriptionRow[]>()

  if (error) {
    logServerError('push-messaging:load', error)
    return { sent: 0, gone: 0, failed: 0 }
  }

  const rows = data ?? []
  let sent = 0
  let gone = 0
  let failed = 0

  for (const row of rows) {
    const result = await sendToRow(row, payload)
    if (result === 'ok') sent += 1
    else if (result === 'gone') gone += 1
    else failed += 1
  }

  return { sent, gone, failed }
}

/** Рассылка всем сохранённым подпискам (админ-скрипт / полный прогон). */
export async function sendPushToAll(
  payload: PushPayload,
): Promise<{ subscribers: number; sent: number; gone: number; failed: number }> {
  if (!ensureVapid()) {
    return { subscribers: 0, sent: 0, gone: 0, failed: 0 }
  }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, subscriber_id, endpoint, p256dh, auth')
    .returns<(PushSubscriptionRow & { subscriber_id: string })[]>()

  if (error) {
    logServerError('push-messaging:load-all', error)
    return { subscribers: 0, sent: 0, gone: 0, failed: 0 }
  }

  const rows = data ?? []
  const subscriberIds = new Set(rows.map((r) => r.subscriber_id))
  let sent = 0
  let gone = 0
  let failed = 0

  for (const row of rows) {
    const result = await sendToRow(row, payload)
    if (result === 'ok') sent += 1
    else if (result === 'gone') gone += 1
    else failed += 1
  }

  return { subscribers: subscriberIds.size, sent, gone, failed }
}

export async function countPushSubscriptions(): Promise<number> {
  const db = createSupabaseAdminClient()
  const { count } = await db
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
  return count ?? 0
}

export async function countPushSubscribers(): Promise<number> {
  const db = createSupabaseAdminClient()
  const { data } = await db.from('push_subscriptions').select('subscriber_id')
  return new Set((data ?? []).map((r) => r.subscriber_id)).size
}

/** Один батч endpoint-ов (для админ-UI / Vercel timeout). */
export async function sendPushBatch(args: {
  payload: PushPayload
  offset: number
  limit?: number
  subscriberId?: string
}): Promise<{
  sent: number
  gone: number
  failed: number
  processed: number
  nextOffset: number
  done: boolean
  total: number
}> {
  if (!ensureVapid()) {
    return {
      sent: 0,
      gone: 0,
      failed: 0,
      processed: 0,
      nextOffset: args.offset,
      done: true,
      total: 0,
    }
  }

  const limit = args.limit ?? PUSH_SEND_BATCH_SIZE
  const db = createSupabaseAdminClient()

  let totalQuery = db
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
  if (args.subscriberId) {
    totalQuery = totalQuery.eq('subscriber_id', args.subscriberId)
  }
  const { count } = await totalQuery
  const total = count ?? 0

  let pageQuery = db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, subscriber_id')
    .order('created_at', { ascending: true })
    .range(args.offset, args.offset + limit - 1)
  if (args.subscriberId) {
    pageQuery = pageQuery.eq('subscriber_id', args.subscriberId)
  }

  const { data, error } = await pageQuery.returns<PushSubscriptionRow[]>()
  if (error) {
    logServerError('push-messaging:batch', error)
    return {
      sent: 0,
      gone: 0,
      failed: 0,
      processed: 0,
      nextOffset: args.offset,
      done: true,
      total,
    }
  }

  const rows = data ?? []
  let sent = 0
  let gone = 0
  let failed = 0

  for (const row of rows) {
    const result = await sendToRow(row, args.payload)
    if (result === 'ok') sent += 1
    else if (result === 'gone') gone += 1
    else failed += 1
  }

  const nextOffset = args.offset + rows.length
  return {
    sent,
    gone,
    failed,
    processed: rows.length,
    nextOffset,
    done: nextOffset >= total || rows.length === 0,
    total,
  }
}
