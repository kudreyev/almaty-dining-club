import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const MONTHLY_PRICE_KZT = 1990

export type MetricsDailySnapshot = {
  date: string
  active_subscribers: number
  active_paid_subscribers: number
  mrr_kzt: number
  new_subs_24h: number
  new_paid_subs_24h: number
  redemptions_24h: number
  whatsapp_clicks_24h: number
  whatsapp_clicks_by_source: Record<string, number>
  retention_30d_pct: number | null
  expiring_next_7d: number
}

/** UTC ISO-границы календарного дня в часовом поясе Алматы (UTC+5). */
export function almatyDayUtcBounds(date: string): { start: string; end: string } {
  const [yStr, mStr, dStr] = date.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 5 * 60 * 60 * 1000
  const endMs = startMs + 24 * 60 * 60 * 1000
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  }
}

function almatyDateFromOffset(daysOffset: number): string {
  const now = new Date()
  const almatyMs = now.getTime() + 5 * 60 * 60 * 1000
  const almaty = new Date(almatyMs)
  almaty.setUTCDate(almaty.getUTCDate() + daysOffset)
  return almaty.toISOString().slice(0, 10)
}

export function yesterdayAlmatyDate(): string {
  return almatyDateFromOffset(-1)
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-')
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function countActiveSubscribersAtEndOfDay(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  date: string,
  planType?: 'paid',
) {
  const { end } = almatyDayUtcBounds(date)
  let q = admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('end_date', date)
    .lt('created_at', end)
  if (planType) q = q.eq('plan_type', planType)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function countNewSubscriptionsInDay(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  date: string,
  planType?: 'paid',
) {
  const { start, end } = almatyDayUtcBounds(date)
  let q = admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', start)
    .lt('created_at', end)
  if (planType) q = q.eq('plan_type', planType)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function countRedemptionsInDay(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  date: string,
) {
  const { start, end } = almatyDayUtcBounds(date)
  const { count, error } = await admin
    .from('redemptions')
    .select('id', { count: 'exact', head: true })
    .gte('redeemed_at', start)
    .lt('redeemed_at', end)
  if (error) throw error
  return count ?? 0
}

async function loadWhatsappClicksInDay(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  date: string,
) {
  const { start, end } = almatyDayUtcBounds(date)
  const { data, error } = await admin
    .from('analytics_events')
    .select('meta')
    .eq('event_name', 'whatsapp_click')
    .gte('created_at', start)
    .lt('created_at', end)
  if (error) throw error

  const bySource: Record<string, number> = {}
  for (const row of data ?? []) {
    const raw = row.meta?.source
    const source = typeof raw === 'string' && raw.length > 0 ? raw : '(без source)'
    bySource[source] = (bySource[source] ?? 0) + 1
  }

  const total = Object.values(bySource).reduce((sum, n) => sum + n, 0)
  return { total, bySource }
}

async function computeRetention30dPct(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  asOfDate: string,
): Promise<number | null> {
  const { end } = almatyDayUtcBounds(asOfDate)
  const cohortEndMs = new Date(end).getTime() - 30 * 86_400_000
  const cohortStartMs = cohortEndMs - 30 * 86_400_000
  const cohortStart = new Date(cohortStartMs).toISOString()
  const cohortEnd = new Date(cohortEndMs).toISOString()

  const earlyRes = await admin
    .from('subscriptions')
    .select('user_id, created_at')
    .lte('created_at', cohortEnd)
    .order('created_at', { ascending: true })
  if (earlyRes.error) throw earlyRes.error

  const firstByUser = new Map<string, string>()
  for (const row of earlyRes.data ?? []) {
    if (!firstByUser.has(row.user_id)) firstByUser.set(row.user_id, row.created_at)
  }

  const cohort: string[] = []
  for (const [userId, firstCreatedAt] of firstByUser) {
    if (firstCreatedAt >= cohortStart && firstCreatedAt <= cohortEnd) {
      cohort.push(userId)
    }
  }

  if (cohort.length === 0) return null

  const activeRes = await admin
    .from('subscriptions')
    .select('user_id')
    .in('user_id', cohort)
    .eq('status', 'active')
    .gte('end_date', asOfDate)
    .lt('created_at', end)
  if (activeRes.error) throw activeRes.error

  const stillActive = new Set((activeRes.data ?? []).map((r) => r.user_id)).size
  return Math.round((stillActive / cohort.length) * 1000) / 10
}

async function countExpiringNext7d(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  asOfDate: string,
) {
  const in7 = addDaysToIsoDate(asOfDate, 7)
  const { count, error } = await admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('end_date', asOfDate)
    .lte('end_date', in7)
  if (error) throw error
  return count ?? 0
}

/** Считает метрики за календарный день Алматы и возвращает строку для upsert. */
export async function computeDailySnapshot(date: string): Promise<MetricsDailySnapshot> {
  const admin = createSupabaseAdminClient()

  const [
    activeSubscribers,
    activePaidSubscribers,
    newSubs,
    newPaidSubs,
    redemptions,
    whatsapp,
    retentionPct,
    expiringNext7d,
  ] = await Promise.all([
    countActiveSubscribersAtEndOfDay(admin, date),
    countActiveSubscribersAtEndOfDay(admin, date, 'paid'),
    countNewSubscriptionsInDay(admin, date),
    countNewSubscriptionsInDay(admin, date, 'paid'),
    countRedemptionsInDay(admin, date),
    loadWhatsappClicksInDay(admin, date),
    computeRetention30dPct(admin, date),
    countExpiringNext7d(admin, date),
  ])

  return {
    date,
    active_subscribers: activeSubscribers,
    active_paid_subscribers: activePaidSubscribers,
    mrr_kzt: activePaidSubscribers * MONTHLY_PRICE_KZT,
    new_subs_24h: newSubs,
    new_paid_subs_24h: newPaidSubs,
    redemptions_24h: redemptions,
    whatsapp_clicks_24h: whatsapp.total,
    whatsapp_clicks_by_source: whatsapp.bySource,
    retention_30d_pct: retentionPct,
    expiring_next_7d: expiringNext7d,
  }
}

export type MetricsDailySnapshotRow = MetricsDailySnapshot & {
  computed_at: string
}

export async function loadSnapshotByDate(
  date: string,
): Promise<MetricsDailySnapshotRow | null> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('metrics_daily_snapshot')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    date: data.date,
    active_subscribers: data.active_subscribers,
    active_paid_subscribers: data.active_paid_subscribers,
    mrr_kzt: data.mrr_kzt,
    new_subs_24h: data.new_subs_24h,
    new_paid_subs_24h: data.new_paid_subs_24h,
    redemptions_24h: data.redemptions_24h,
    whatsapp_clicks_24h: data.whatsapp_clicks_24h,
    whatsapp_clicks_by_source:
      typeof data.whatsapp_clicks_by_source === 'object' &&
      data.whatsapp_clicks_by_source !== null &&
      !Array.isArray(data.whatsapp_clicks_by_source)
        ? (data.whatsapp_clicks_by_source as Record<string, number>)
        : {},
    retention_30d_pct:
      data.retention_30d_pct == null ? null : Number(data.retention_30d_pct),
    expiring_next_7d: data.expiring_next_7d,
    computed_at: data.computed_at,
  }
}

export async function upsertDailySnapshot(snapshot: MetricsDailySnapshot): Promise<void> {
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('metrics_daily_snapshot').upsert(
    {
      ...snapshot,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'date' },
  )
  if (error) throw error
}

export function previousAlmatyDate(date: string): string {
  return addDaysToIsoDate(date, -1)
}
