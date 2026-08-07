/**
 * Агрегации для /admin/analytics из subscribers + payments + daily_ad_stats.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { MONTHLY_PRICE_KZT, almatyDayUtcBounds } from '@/lib/metrics-snapshot'
import { isPaidMedium } from '@/lib/ttp-analytics-ledger'

export { MONTHLY_PRICE_KZT }

export const CAC_STOP_THRESHOLD = 4000
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

type SubRow = {
  id: string
  status: string
  subscribed_at: string
  cancelled_at: string | null
  utm_source: string | null
  utm_medium: string | null
}

export type AnalyticsRealtime = {
  active: number
  mrr: number
  newToday: number
  new7d: number
  cancelled30d: number
  churn30d: number | null
  /** Использований офферов за сегодня (Алматы). */
  redemptionsToday: number
}

export type AnalyticsEfficiency = {
  spend: number
  paidNew: number
  cac: number | null
  visits: number
  newTotal: number
  landingCr: number | null
  organicShare: number | null
  /** Использований офферов за выбранный период. */
  redemptionsPeriod: number
}

export type ChannelRow = {
  utm_source: string
  subscribers: number
  share: number
  cac: number | null
  isPaid: boolean
}

export type AnalyticsSeries = {
  dates: string[]
  activeByDay: number[]
  newByDay: number[]
  cancelledByDay: number[]
  spendByDay: number[]
  newByDayAll: number[]
}

export type AdminAnalyticsData = {
  periodDays: AnalyticsPeriodDays
  periodFrom: string
  periodTo: string
  realtime: AnalyticsRealtime
  efficiency: AnalyticsEfficiency
  channels: ChannelRow[]
  series: AnalyticsSeries
}

export async function loadAdminAnalytics(
  periodDays: AnalyticsPeriodDays,
): Promise<AdminAnalyticsData> {
  const db = createSupabaseAdminClient()
  const today = almatyNowDate()
  const periodTo = today
  const periodFrom = addDaysIso(today, -(periodDays - 1))

  const todayBounds = almatyDayUtcBounds(today)
  const d7Start = almatyDayUtcBounds(addDaysIso(today, -6)).start
  const d30StartDate = addDaysIso(today, -29)
  const d30Start = almatyDayUtcBounds(d30StartDate).start
  const periodStart = almatyDayUtcBounds(periodFrom).start
  const periodEndExclusive = almatyDayUtcBounds(addDaysIso(periodTo, 1)).start

  const [
    { data: subsData },
    { data: adStats },
    { count: redemptionsTodayCount },
    { count: redemptionsPeriodCount },
  ] = await Promise.all([
    db
      .from('subscribers')
      .select('id, status, subscribed_at, cancelled_at, utm_source, utm_medium')
      .order('subscribed_at', { ascending: true })
      .limit(20000),
    db
      .from('daily_ad_stats')
      .select('date, spend, visits, goal_click_pay')
      .gte('date', periodFrom)
      .lte('date', periodTo),
    db
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .gte('redeemed_at', todayBounds.start)
      .lt('redeemed_at', todayBounds.end),
    db
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .gte('redeemed_at', periodStart)
      .lt('redeemed_at', periodEndExclusive),
  ])

  const rows = (subsData ?? []) as SubRow[]
  const ads = (adStats ?? []) as Array<{
    date: string
    spend: number | null
    visits: number | null
    goal_click_pay: number | null
  }>

  const active = rows.filter((r) => r.status === 'active').length

  const newToday = rows.filter(
    (r) =>
      r.subscribed_at >= todayBounds.start &&
      r.subscribed_at < todayBounds.end,
  ).length
  const new7d = rows.filter((r) => r.subscribed_at >= d7Start).length
  const cancelled30d = rows.filter(
    (r) => r.cancelled_at != null && r.cancelled_at >= d30Start,
  ).length

  const activeAt30Start = rows.filter((r) => {
    if (r.subscribed_at >= d30Start) return false
    if (!r.cancelled_at) return r.status === 'active' || r.status === 'past_due'
    return r.cancelled_at >= d30Start
  }).length
  const churnDenom = activeAt30Start > 0 ? activeAt30Start : Math.max(active, 1)
  const churn30d = cancelled30d / churnDenom

  const newInPeriod = rows.filter(
    (r) =>
      r.subscribed_at >= periodStart && r.subscribed_at < periodEndExclusive,
  )
  const paidNew = newInPeriod.filter((r) => isPaidMedium(r.utm_medium)).length
  const organicNew = newInPeriod.filter((r) => !isPaidMedium(r.utm_medium)).length
  const newTotal = newInPeriod.length

  const spend = ads.reduce((s, r) => s + (Number(r.spend) || 0), 0)
  const visits = ads.reduce((s, r) => s + (Number(r.visits) || 0), 0)
  const cac = paidNew > 0 ? spend / paidNew : null
  const landingCr = visits > 0 ? newTotal / visits : null
  const organicShare = newTotal > 0 ? organicNew / newTotal : null

  const bySource = new Map<string, { count: number; paid: boolean }>()
  for (const r of newInPeriod) {
    const key = (r.utm_source?.trim() || 'direct').slice(0, 64)
    const prev = bySource.get(key) ?? {
      count: 0,
      paid: isPaidMedium(r.utm_medium),
    }
    prev.count += 1
    prev.paid = prev.paid || isPaidMedium(r.utm_medium)
    bySource.set(key, prev)
  }

  const channels: ChannelRow[] = [...bySource.entries()]
    .map(([utm_source, v]) => ({
      utm_source,
      subscribers: v.count,
      share: newTotal > 0 ? v.count / newTotal : 0,
      // Spend по аккаунту целиком — CAC показываем только для paid-каналов.
      cac: v.paid && paidNew > 0 ? spend / paidNew : null,
      isPaid: v.paid,
    }))
    .sort((a, b) => b.subscribers - a.subscribers)

  const dates = eachDateInclusive(periodFrom, periodTo)
  const newByDay: number[] = []
  const cancelledByDay: number[] = []
  const spendByDay: number[] = []
  const newByDayAll: number[] = []
  const activeByDay: number[] = []
  const spendMap = new Map(ads.map((a) => [a.date, Number(a.spend) || 0]))

  for (const date of dates) {
    const bounds = almatyDayUtcBounds(date)
    const news = rows.filter(
      (r) => r.subscribed_at >= bounds.start && r.subscribed_at < bounds.end,
    )
    newByDayAll.push(news.length)
    newByDay.push(news.length)
    cancelledByDay.push(
      rows.filter(
        (r) =>
          r.cancelled_at != null &&
          r.cancelled_at >= bounds.start &&
          r.cancelled_at < bounds.end,
      ).length,
    )
    spendByDay.push(spendMap.get(date) ?? 0)

    activeByDay.push(
      rows.filter((r) => {
        if (r.subscribed_at >= bounds.end) return false
        if (!r.cancelled_at) return true
        return r.cancelled_at >= bounds.end
      }).length,
    )
  }

  return {
    periodDays,
    periodFrom,
    periodTo,
    realtime: {
      active,
      mrr: active * MONTHLY_PRICE_KZT,
      newToday,
      new7d,
      cancelled30d,
      churn30d,
      redemptionsToday: redemptionsTodayCount ?? 0,
    },
    efficiency: {
      spend,
      paidNew,
      cac,
      visits,
      newTotal,
      landingCr,
      organicShare,
      redemptionsPeriod: redemptionsPeriodCount ?? 0,
    },
    channels,
    series: {
      dates,
      activeByDay,
      newByDay,
      cancelledByDay,
      spendByDay,
      newByDayAll,
    },
  }
}
