/**
 * Web Push (VAPID) — рядом с WhatsApp access-messaging.
 * subscriberId = profiles.id (залогиненный пользователь).
 *
 * Правила для всех рассылок (кроме тестовой «себе» из админки):
 * - не больше 2 кампаний на человека за 7 дней (push_weekly_count по push_log);
 * - только 11:00–21:00 по Алматы (push_allowed_now);
 * - 404/410 от push-сервиса → is_active = false (строку не удаляем);
 * - каждая отправка пишется в push_log.
 */

import webpush from 'web-push'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'
import { safeLog } from '@/lib/safe-logger'

export const PUSH_WEEKLY_LIMIT = 2

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
  /** UUID из push_campaigns (админка) — для click_count. */
  campaignId?: string
  /** Ключ кампании для лимита, push_log и utm_campaign. По умолчанию campaignId или tag. */
  campaign?: string
  icon?: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  subscriber_id: string
}

type SendOptions = {
  /** Тестовая отправка себе: без лимита и окна, в лог пишется. */
  bypassLimits?: boolean
}

export type PushSendResult = {
  sent: number
  gone: number
  failed: number
  /** Получатели, у которых уже 2 кампании за неделю. */
  skippedQuota: number
  /** Вне окна 11:00–21:00 Алматы — ничего не отправлено. */
  quietHours?: boolean
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

export function campaignKey(payload: PushPayload): string {
  return (payload.campaign || payload.campaignId || payload.tag || 'kudaclub').slice(0, 120)
}

export function resolvePushUrl(url: string, campaignId?: string, campaign?: string): string {
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
    if (!parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', 'push')
    if (!parsed.searchParams.has('utm_campaign') && (campaign || campaignId)) {
      parsed.searchParams.set('utm_campaign', campaign || campaignId!)
    }
    return parsed.href
  } catch {
    return absolute
  }
}

/** Ключ кампании для повторяющихся рассылок: один и тот же tag в разные дни — разные кампании. */
export function datedCampaign(tag: string, at = new Date()): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(at)
  return `${tag}:${day}`
}

function isGoneStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}

export async function isPushWindowOpen(): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const { data, error } = await db.rpc('push_allowed_now')
  if (error) {
    logServerError('push-messaging:window', error)
    return false
  }
  return data === true
}

async function hasWeeklyQuota(userId: string, campaign: string): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const { data, error } = await db.rpc('push_weekly_count', {
    p_user: userId,
    p_exclude_campaign: campaign,
  })
  if (error) {
    logServerError('push-messaging:quota', error)
    return false
  }
  return typeof data === 'number' && data < PUSH_WEEKLY_LIMIT
}

async function sendToRow(
  row: PushSubscriptionRow,
  payload: PushPayload,
): Promise<'ok' | 'gone' | 'error'> {
  const db = createSupabaseAdminClient()
  const campaign = campaignKey(payload)
  const url = resolvePushUrl(payload.url, payload.campaignId, campaign)
  const log = (status: 'sent' | 'failed' | 'gone', errorCode: number | null) =>
    db.from('push_log').insert({
      user_id: row.subscriber_id,
      subscription_id: row.id,
      campaign,
      title: payload.title.slice(0, 200),
      url: url.slice(0, 2000),
      status,
      error_code: errorCode,
    })

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
        url,
        tag,
        icon: payload.icon,
        campaign,
        campaign_id: payload.campaignId ?? null,
      }),
      {
        TTL: 60 * 60 * 12,
        urgency: 'normal',
      },
    )
    await Promise.all([
      db
        .from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString() })
        .eq('id', row.id),
      log('sent', null),
    ])
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
      const [deactivated] = await Promise.all([
        db.from('push_subscriptions').update({ is_active: false }).eq('id', row.id),
        log('gone', statusCode ?? null),
      ])
      if (deactivated.error) {
        logServerError('push-messaging:deactivate', deactivated.error)
        return 'error'
      }
      safeLog.info('[push-messaging] deactivated stale subscription', {
        id: row.id,
        statusCode,
      })
      return 'gone'
    }

    await log('failed', statusCode ?? null)
    logServerError('push-messaging:send', error)
    return 'error'
  }
}

/** Отправить строкам с учётом лимита; quota кэшируется по пользователю в пределах вызова. */
async function sendToRows(
  rows: PushSubscriptionRow[],
  payload: PushPayload,
  options: SendOptions,
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, gone: 0, failed: 0, skippedQuota: 0 }
  const campaign = campaignKey(payload)
  const quota = new Map<string, boolean>()

  for (const row of rows) {
    if (!options.bypassLimits) {
      let allowed = quota.get(row.subscriber_id)
      if (allowed === undefined) {
        allowed = await hasWeeklyQuota(row.subscriber_id, campaign)
        quota.set(row.subscriber_id, allowed)
        if (!allowed) result.skippedQuota += 1
      }
      if (!allowed) continue
    }
    const outcome = await sendToRow(row, payload)
    if (outcome === 'ok') result.sent += 1
    else if (outcome === 'gone') result.gone += 1
    else result.failed += 1
  }
  return result
}

const EMPTY_RESULT: PushSendResult = { sent: 0, gone: 0, failed: 0, skippedQuota: 0 }

/** Отправить web-push всем активным устройствам подписчика. */
export async function sendPush(
  subscriberId: string,
  payload: PushPayload,
  options: SendOptions = {},
): Promise<PushSendResult> {
  if (!ensureVapid()) return { ...EMPTY_RESULT }
  if (!options.bypassLimits && !(await isPushWindowOpen())) {
    return { ...EMPTY_RESULT, quietHours: true }
  }

  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, subscriber_id')
    .eq('subscriber_id', subscriberId)
    .eq('is_active', true)
    .returns<PushSubscriptionRow[]>()

  if (error) {
    logServerError('push-messaging:load', error)
    return { ...EMPTY_RESULT }
  }

  return sendToRows(data ?? [], payload, options)
}

type SegmentRow = { user_id: string; endpoints: number; quota_ok: boolean }

/**
 * Получатели с активной подпиской и неисчерпанным лимитом, с городом
 * (город подписки или последнего кода; неизвестный — Алматы).
 */
export async function pushRecipientsWithCity(
  campaign: string,
): Promise<{ userId: string; city: 'almaty' | 'astana' }[]> {
  const db = createSupabaseAdminClient()
  const [all, astana] = await Promise.all([
    db.rpc('push_segment_recipients', { p_segment: 'all', p_city: null, p_campaign: campaign }),
    db.rpc('push_segment_recipients', { p_segment: 'all', p_city: 'astana', p_campaign: campaign }),
  ])
  if (all.error || astana.error) {
    logServerError('push-messaging:recipients', all.error ?? astana.error)
    return []
  }
  const astanaIds = new Set(((astana.data ?? []) as SegmentRow[]).map((r) => r.user_id))
  return ((all.data ?? []) as SegmentRow[])
    .filter((r) => r.quota_ok)
    .map((r) => ({ userId: r.user_id, city: astanaIds.has(r.user_id) ? 'astana' : 'almaty' }))
}

export async function countPushSubscriptions(): Promise<number> {
  const db = createSupabaseAdminClient()
  const { count } = await db
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  return count ?? 0
}

export async function countPushSubscribers(): Promise<number> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('push_subscriptions')
    .select('subscriber_id')
    .eq('is_active', true)
  return new Set((data ?? []).map((r) => r.subscriber_id)).size
}

/** Один батч endpoint-ов (для админ-UI / Vercel timeout). */
export async function sendPushBatch(args: {
  payload: PushPayload
  offset: number
  limit?: number
  subscriberId?: string
}): Promise<
  PushSendResult & {
    processed: number
    nextOffset: number
    done: boolean
    total: number
  }
> {
  const bypassLimits = Boolean(args.subscriberId)
  const stop = (extra: Partial<PushSendResult> = {}) => ({
    ...EMPTY_RESULT,
    ...extra,
    processed: 0,
    nextOffset: args.offset,
    done: true,
    total: 0,
  })

  if (!ensureVapid()) return stop()
  if (!bypassLimits && !(await isPushWindowOpen())) return stop({ quietHours: true })

  const limit = args.limit ?? PUSH_SEND_BATCH_SIZE
  const db = createSupabaseAdminClient()

  let totalQuery = db
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  if (args.subscriberId) {
    totalQuery = totalQuery.eq('subscriber_id', args.subscriberId)
  }
  const { count } = await totalQuery
  const total = count ?? 0

  let pageQuery = db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, subscriber_id')
    .eq('is_active', true)
    .order('subscriber_id', { ascending: true })
    .order('id', { ascending: true })
    .range(args.offset, args.offset + limit - 1)
  if (args.subscriberId) {
    pageQuery = pageQuery.eq('subscriber_id', args.subscriberId)
  }

  const { data, error } = await pageQuery.returns<PushSubscriptionRow[]>()
  if (error) {
    logServerError('push-messaging:batch', error)
    return { ...stop(), total }
  }

  const rows = data ?? []
  const result = await sendToRows(rows, args.payload, { bypassLimits })
  // Ставшие неактивными строки выпадают из выборки — сдвигаем offset назад, чтобы не пропустить соседей.
  const nextOffset = args.offset + rows.length - result.gone
  return {
    ...result,
    processed: rows.length,
    nextOffset,
    done: nextOffset >= total || rows.length === 0,
    total,
  }
}
