// Рассылка Web Push по сегменту.
//
// Доступ: только сервисный ключ (Authorization: Bearer <service_role>) или JWT
// пользователя с profiles.role = 'admin'.
// Секреты (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (VAPID_PUBLIC_KEY = тот же ключ, что NEXT_PUBLIC_VAPID_KEY в Vercel). Опционально SITE_URL.
//
// По умолчанию dry_run: только число получателей. Реальная отправка — только с "dry_run": false.
// Правила: не больше 2 кампаний на человека за 7 дней, только 11:00–21:00 по Алматы,
// каждая отправка → push_log, 404/410 → push_subscriptions.is_active = false.
//
// Вызов:
//   POST /functions/v1/send-push
//   { "segment": "all" | "inactive_14d" | "new_7d", "city": "almaty" | "astana" | null,
//     "title": "...", "body": "...", "url": "/r/entrecote", "campaign": "friday-entrecote",
//     "icon": "/icons/icon-192.png", "dry_run": true, "limit": 500 }
// Большие сегменты: повторять с тем же campaign, пока remaining > 0 (уже получившие пропускаются).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SEGMENTS = new Set(['all', 'inactive_14d', 'new_7d'])
const CITIES = new Set(['almaty', 'astana'])
const WEEKLY_LIMIT = 2
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000
const CONCURRENCY = 8

type SegmentRow = { user_id: string; endpoints: number; quota_ok: boolean }
type SubscriptionRow = {
  id: string
  subscriber_id: string
  endpoint: string
  p256dh: string
  auth: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function isAdminRequest(req: Request, admin: SupabaseClient): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (timingSafeEqual(token, serviceKey)) return true

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return false
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle<{ role: string }>()
  return profile?.role === 'admin'
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function almatyDate(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(at)
}

function resolveUrl(path: string, campaign: string): string {
  const site = (Deno.env.get('SITE_URL') || 'https://kudaclub.kz').replace(/\/$/, '')
  const url = new URL(path, `${site}/`)
  if (url.origin !== new URL(site).origin) throw new Error('external_url')
  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'push')
  if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', campaign)
  return url.href
}

function statusCodeOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode
    return typeof code === 'number' ? code : null
  }
  return null
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let index = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  if (!(await isAdminRequest(req, admin))) return json({ error: 'forbidden' }, 403)

  let input: Record<string, unknown>
  try {
    input = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const segment = typeof input.segment === 'string' ? input.segment : 'all'
  if (!SEGMENTS.has(segment)) return json({ error: 'invalid_segment', allowed: [...SEGMENTS] }, 400)

  const city = typeof input.city === 'string' && input.city ? input.city : null
  if (city !== null && !CITIES.has(city)) return json({ error: 'invalid_city' }, 400)

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const path = typeof input.url === 'string' && input.url.trim() ? input.url.trim() : '/'
  if (!title || title.length > 80) return json({ error: 'invalid_title' }, 400)
  if (!body || body.length > 200) return json({ error: 'invalid_body' }, 400)
  if (/\{\w+\}/.test(title + body + path)) return json({ error: 'unfilled_placeholders' }, 400)

  const campaign =
    (typeof input.campaign === 'string' && input.campaign.trim()
      ? input.campaign.trim()
      : `${almatyDate()}-${slugify(title)}`
    ).slice(0, 120)

  let url: string
  try {
    url = resolveUrl(path, campaign)
  } catch {
    return json({ error: 'invalid_url' }, 400)
  }

  const dryRun = input.dry_run !== false && input.dry_run !== 'false'
  const limit = Math.min(
    Math.max(Number.parseInt(String(input.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  )

  const { data: segmentRows, error: segmentError } = await admin.rpc('push_segment_recipients', {
    p_segment: segment,
    p_city: city,
    p_campaign: campaign,
  })
  if (segmentError) return json({ error: 'segment_failed', details: segmentError.message }, 500)

  const { data: alreadySentRows, error: sentError } = await admin
    .from('push_log')
    .select('user_id')
    .eq('campaign', campaign)
    .eq('status', 'sent')
  if (sentError) return json({ error: 'log_failed', details: sentError.message }, 500)
  const alreadySent = new Set((alreadySentRows ?? []).map((r: { user_id: string }) => r.user_id))

  const rows = (segmentRows ?? []) as SegmentRow[]
  const eligible = rows.filter((r) => r.quota_ok && !alreadySent.has(r.user_id))
  const { data: withinHours } = await admin.rpc('push_allowed_now')

  const summary = {
    dry_run: dryRun,
    segment,
    city,
    campaign,
    url,
    within_hours: withinHours === true,
    recipients: rows.length,
    endpoints: rows.reduce((sum, r) => sum + r.endpoints, 0),
    skipped_quota: rows.filter((r) => !r.quota_ok).length,
    already_sent: rows.filter((r) => alreadySent.has(r.user_id)).length,
    eligible: eligible.length,
    weekly_limit: WEEKLY_LIMIT,
  }

  if (dryRun) return json(summary)

  if (withinHours !== true) {
    return json({ ...summary, error: 'quiet_hours', message: 'Только 11:00–21:00 по Алматы' }, 409)
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  const subject = Deno.env.get('VAPID_SUBJECT') ?? ''
  if (!publicKey || !privateKey || !subject) return json({ error: 'vapid_secrets_missing' }, 500)
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const batch = eligible.slice(0, limit)
  const userIds = batch.map((r) => r.user_id)
  const subs: SubscriptionRow[] = []
  // Чанки: длинный список id не помещается в URL запроса PostgREST.
  for (let i = 0; i < userIds.length; i += 150) {
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('id, subscriber_id, endpoint, p256dh, auth')
      .in('subscriber_id', userIds.slice(i, i + 150))
      .eq('is_active', true)
    if (error) return json({ error: 'subscriptions_failed', details: error.message }, 500)
    subs.push(...((data ?? []) as SubscriptionRow[]))
  }

  const icon = typeof input.icon === 'string' && input.icon.startsWith('/') ? input.icon : '/icons/icon-192.png'
  const payload = JSON.stringify({ title, body, url, icon, tag: `campaign:${campaign}`, campaign })
  const result = { sent: 0, gone: 0, failed: 0 }

  await pool(subs, CONCURRENCY, async (sub) => {
    let status: 'sent' | 'failed' | 'gone' = 'sent'
    let errorCode: number | null = null
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 12, urgency: 'normal' },
      )
      result.sent += 1
      await admin
        .from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (error) {
      errorCode = statusCodeOf(error)
      if (errorCode === 404 || errorCode === 410) {
        status = 'gone'
        result.gone += 1
        await admin.from('push_subscriptions').update({ is_active: false }).eq('id', sub.id)
      } else {
        status = 'failed'
        result.failed += 1
      }
    }
    await admin.from('push_log').insert({
      user_id: sub.subscriber_id,
      subscription_id: sub.id,
      campaign,
      title: title.slice(0, 200),
      url,
      status,
      error_code: errorCode,
    })
  })

  return json({
    ...summary,
    processed_users: batch.length,
    remaining: eligible.length - batch.length,
    ...result,
  })
})
