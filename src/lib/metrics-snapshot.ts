import { createCustomerMetricsScope, type CustomerMetricsScope } from '@/lib/customer-metrics'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type MetricsDailySnapshot = {
  date: string
  /** Гости с подтверждённым телефоном на конец дня. */
  members_total: number
  /** Первые подтверждения телефона за день (signup_completed). */
  new_members_24h: number
  codes_issued_24h: number
  redemptions_24h: number
  whatsapp_clicks_24h: number
  whatsapp_clicks_by_source: Record<string, number>
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

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

async function countMembersAtEndOfDay(admin: AdminClient, date: string) {
  const { end } = almatyDayUtcBounds(date)
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('phone', 'is', null)
    .eq('user_kind', 'customer')
    .lt('created_at', end)
  if (error) throw error
  return count ?? 0
}

async function countUserEventsInDay(
  scope: CustomerMetricsScope,
  admin: AdminClient,
  eventName: string,
  date: string,
) {
  const { start, end } = almatyDayUtcBounds(date)
  const { data, error } = await admin
    .from('analytics_events')
    .select('user_id')
    .eq('event_name', eventName)
    .gte('created_at', start)
    .lt('created_at', end)
  if (error) throw error
  return scope.filterNullableUserRows(data ?? []).length
}

async function countRedemptionsInDay(
  scope: CustomerMetricsScope,
  admin: AdminClient,
  date: string,
) {
  const { start, end } = almatyDayUtcBounds(date)
  const { data, error } = await scope.applyUserIdExclusion(
    admin
      .from('redemptions')
      .select('id')
      .gte('redeemed_at', start)
      .lt('redeemed_at', end),
  )
  if (error) throw error
  return (data ?? []).length
}

async function loadWhatsappClicksInDay(admin: AdminClient, date: string) {
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

/** Считает метрики за календарный день Алматы и возвращает строку для upsert. */
export async function computeDailySnapshot(date: string): Promise<MetricsDailySnapshot> {
  const admin = createSupabaseAdminClient()
  const scope = await createCustomerMetricsScope(admin)

  const [membersTotal, newMembers, codesIssued, redemptions, whatsapp] =
    await Promise.all([
      countMembersAtEndOfDay(admin, date),
      countUserEventsInDay(scope, admin, 'signup_completed', date),
      countUserEventsInDay(scope, admin, 'code_requested', date),
      countRedemptionsInDay(scope, admin, date),
      loadWhatsappClicksInDay(admin, date),
    ])

  return {
    date,
    members_total: membersTotal,
    new_members_24h: newMembers,
    codes_issued_24h: codesIssued,
    redemptions_24h: redemptions,
    whatsapp_clicks_24h: whatsapp.total,
    whatsapp_clicks_by_source: whatsapp.bySource,
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
    .select(
      'date, members_total, new_members_24h, codes_issued_24h, redemptions_24h, whatsapp_clicks_24h, whatsapp_clicks_by_source, computed_at',
    )
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    date: data.date,
    members_total: data.members_total ?? 0,
    new_members_24h: data.new_members_24h ?? 0,
    codes_issued_24h: data.codes_issued_24h ?? 0,
    redemptions_24h: data.redemptions_24h ?? 0,
    whatsapp_clicks_24h: data.whatsapp_clicks_24h ?? 0,
    whatsapp_clicks_by_source:
      typeof data.whatsapp_clicks_by_source === 'object' &&
      data.whatsapp_clicks_by_source !== null &&
      !Array.isArray(data.whatsapp_clicks_by_source)
        ? (data.whatsapp_clicks_by_source as Record<string, number>)
        : {},
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
