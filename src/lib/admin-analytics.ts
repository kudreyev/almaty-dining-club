/**
 * Агрегации для /admin/analytics: регистрации (profiles с телефоном),
 * выданные коды (redeem_tokens), использования (redemptions), расход (daily_ad_stats).
 */

import { createCustomerMetricsScope } from '@/lib/customer-metrics'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { almatyDayUtcBounds } from '@/lib/metrics-snapshot'

export const PERIOD_OPTIONS = [7, 30, 90] as const
export type AnalyticsPeriodDays = (typeof PERIOD_OPTIONS)[number]

export function parsePeriodDays(raw: string | undefined): AnalyticsPeriodDays {
  const n = Number(raw)
  if (n === 7 || n === 30 || n === 90) return n
  return 30
}

function almatyNowDate(): string {
  const now = new Date()
  const almatyMs = now.getTime() + 5 * 60 * 60 * 1000
  return new Date(almatyMs).toISOString().slice(0, 10)
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  while (cur <= to) {
    out.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return out
}

function countInRange(timestamps: string[], start: string, end: string): number {
  let n = 0
  for (const ts of timestamps) {
    if (ts >= start && ts < end) n += 1
  }
  return n
}

export type AnalyticsRealtime = {
  members: number
  signupsToday: number
  signups7d: number
  codesToday: number
  redemptionsToday: number
  /** Уникальные гости с использованием за 30 дней. */
  activeGuests30d: number
}

export type AnalyticsEfficiency = {
  spend: number
  signups: number
  costPerSignup: number | null
  codes: number
  redemptions: number
  /** Использования / выданные коды за период. */
  codeToRedeem: number | null
}

export type AnalyticsSeries = {
  dates: string[]
  signupsByDay: number[]
  codesByDay: number[]
  redemptionsByDay: number[]
  spendByDay: number[]
}

export type AdminAnalyticsData = {
  periodDays: AnalyticsPeriodDays
  periodFrom: string
  periodTo: string
  realtime: AnalyticsRealtime
  efficiency: AnalyticsEfficiency
  series: AnalyticsSeries
}

export async function loadAdminAnalytics(
  periodDays: AnalyticsPeriodDays,
): Promise<AdminAnalyticsData> {
  const db = createSupabaseAdminClient()
  const scope = await createCustomerMetricsScope(db)
  const today = almatyNowDate()
  const periodTo = today
  const periodFrom = addDaysIso(today, -(periodDays - 1))

  const todayBounds = almatyDayUtcBounds(today)
  const d7Start = almatyDayUtcBounds(addDaysIso(today, -6)).start
  const d30Start = almatyDayUtcBounds(addDaysIso(today, -29)).start
  const periodStart = almatyDayUtcBounds(periodFrom).start
  const periodEnd = almatyDayUtcBounds(addDaysIso(periodTo, 1)).start
  const windowStart = periodStart < d30Start ? periodStart : d30Start

  const [membersRes, signupsRes, tokensRes, redemptionsRes, adsRes] =
    await Promise.all([
      db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('phone', 'is', null)
        .eq('user_kind', 'customer'),
      db
        .from('profiles')
        .select('created_at')
        .not('phone', 'is', null)
        .eq('user_kind', 'customer')
        .gte('created_at', windowStart)
        .limit(20000),
      scope.applyUserIdExclusion(
        db
          .from('redeem_tokens')
          .select('issued_at')
          .gte('issued_at', windowStart)
          .limit(50000),
      ),
      scope.applyUserIdExclusion(
        db
          .from('redemptions')
          .select('user_id, redeemed_at')
          .gte('redeemed_at', windowStart)
          .limit(50000),
      ),
      db
        .from('daily_ad_stats')
        .select('date, spend')
        .gte('date', periodFrom)
        .lte('date', periodTo),
    ])

  if (membersRes.error) throw membersRes.error
  if (signupsRes.error) throw signupsRes.error
  if (tokensRes.error) throw tokensRes.error
  if (redemptionsRes.error) throw redemptionsRes.error
  if (adsRes.error) throw adsRes.error

  const signupTs = (signupsRes.data ?? []).map((r) => r.created_at as string)
  const tokenTs = (tokensRes.data ?? []).map((r) => r.issued_at as string)
  const redemptionRows = (redemptionsRes.data ?? []) as Array<{
    user_id: string
    redeemed_at: string
  }>
  const redemptionTs = redemptionRows.map((r) => r.redeemed_at)
  const ads = (adsRes.data ?? []) as Array<{ date: string; spend: number | null }>

  const activeGuests30d = new Set(
    redemptionRows.filter((r) => r.redeemed_at >= d30Start).map((r) => r.user_id),
  ).size

  const spend = ads.reduce((s, r) => s + (Number(r.spend) || 0), 0)
  const signups = countInRange(signupTs, periodStart, periodEnd)
  const codes = countInRange(tokenTs, periodStart, periodEnd)
  const redemptions = countInRange(redemptionTs, periodStart, periodEnd)

  const dates = eachDateInclusive(periodFrom, periodTo)
  const spendMap = new Map(ads.map((a) => [a.date, Number(a.spend) || 0]))
  const series: AnalyticsSeries = {
    dates,
    signupsByDay: [],
    codesByDay: [],
    redemptionsByDay: [],
    spendByDay: [],
  }
  for (const date of dates) {
    const { start, end } = almatyDayUtcBounds(date)
    series.signupsByDay.push(countInRange(signupTs, start, end))
    series.codesByDay.push(countInRange(tokenTs, start, end))
    series.redemptionsByDay.push(countInRange(redemptionTs, start, end))
    series.spendByDay.push(spendMap.get(date) ?? 0)
  }

  return {
    periodDays,
    periodFrom,
    periodTo,
    realtime: {
      members: membersRes.count ?? 0,
      signupsToday: countInRange(signupTs, todayBounds.start, todayBounds.end),
      signups7d: countInRange(signupTs, d7Start, todayBounds.end),
      codesToday: countInRange(tokenTs, todayBounds.start, todayBounds.end),
      redemptionsToday: countInRange(redemptionTs, todayBounds.start, todayBounds.end),
      activeGuests30d,
    },
    efficiency: {
      spend,
      signups,
      costPerSignup: signups > 0 ? spend / signups : null,
      codes,
      redemptions,
      codeToRedeem: codes > 0 ? redemptions / codes : null,
    },
    series,
  }
}
