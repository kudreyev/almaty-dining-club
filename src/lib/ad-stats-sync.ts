/**
 * Синхронизация daily_ad_stats: Facebook Ads + Яндекс.Метрика за день.
 * Ошибки одного источника не роняют весь sync — поля остаются NULL.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchFacebookDayInsights } from '@/lib/facebook-ads'
import { logServerError } from '@/lib/safe-errors'

const REPORTING_BASE = 'https://api-metrika.yandex.net/stat/v1/data'

export type DailyAdStatsRow = {
  date: string
  spend: number | null
  impressions: number | null
  clicks: number | null
  visits: number | null
  goal_click_pay: number | null
}

export type AdStatsSyncResult = {
  date: string
  row: DailyAdStatsRow
  errors: string[]
}

async function fetchMetricaVisitsAndGoal(args: {
  date: string
  counterId: string
  goalId: string
  token: string
}): Promise<{ visits: number; goal_click_pay: number }> {
  const url = new URL(REPORTING_BASE)
  url.searchParams.set('ids', args.counterId)
  url.searchParams.set(
    'metrics',
    `ym:s:visits,ym:s:goal${args.goalId}reaches`,
  )
  url.searchParams.set('date1', args.date)
  url.searchParams.set('date2', args.date)
  url.searchParams.set('accuracy', 'full')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `OAuth ${args.token}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Metrica Reporting API ${res.status}: ${await res.text()}`)
  }

  const body = (await res.json()) as { totals?: number[] }
  const totals = body.totals ?? [0, 0]
  return {
    visits: Math.round(totals[0] ?? 0),
    goal_click_pay: Math.round(totals[1] ?? 0),
  }
}

function envOrNull(...names: string[]): string | null {
  for (const name of names) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  return null
}

/** Upsert строки daily_ad_stats за date (обычно вчера по Алматы). */
export async function syncDailyAdStats(date: string): Promise<AdStatsSyncResult> {
  const errors: string[] = []
  const row: DailyAdStatsRow = {
    date,
    spend: null,
    impressions: null,
    clicks: null,
    visits: null,
    goal_click_pay: null,
  }

  const fbToken = envOrNull('FB_TOKEN')
  const fbAccount = envOrNull('FB_AD_ACCOUNT')
  if (fbToken && fbAccount) {
    try {
      const fb = await fetchFacebookDayInsights({
        date,
        accessToken: fbToken,
        adAccountId: fbAccount,
      })
      row.spend = fb.spend
      row.impressions = fb.impressions
      row.clicks = fb.clicks
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`facebook: ${msg}`)
      logServerError('ad-stats-sync:facebook', error)
    }
  } else {
    errors.push('facebook: FB_TOKEN / FB_AD_ACCOUNT not configured')
    logServerError(
      'ad-stats-sync:facebook',
      new Error('FB_TOKEN / FB_AD_ACCOUNT not configured'),
    )
  }

  const metrikaToken = envOrNull(
    'METRIKA_TOKEN',
    'YANDEX_METRIKA_OAUTH_TOKEN',
    'YANDEX_OAUTH_TOKEN',
  )
  const counterId = envOrNull(
    'METRIKA_COUNTER_ID',
    'YANDEX_METRIKA_COUNTER_ID',
    'NEXT_PUBLIC_YM_ID',
  )
  const goalId = envOrNull('METRIKA_GOAL_CLICK_PAY')
  if (metrikaToken && counterId && goalId) {
    try {
      const m = await fetchMetricaVisitsAndGoal({
        date,
        counterId,
        goalId,
        token: metrikaToken,
      })
      row.visits = m.visits
      row.goal_click_pay = m.goal_click_pay
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`metrika: ${msg}`)
      logServerError('ad-stats-sync:metrika', error)
    }
  } else {
    errors.push(
      'metrika: token/counter/goal not configured (need OAuth + counter + METRIKA_GOAL_CLICK_PAY)',
    )
    logServerError(
      'ad-stats-sync:metrika',
      new Error('Metrica env not fully configured'),
    )
  }

  const db = createSupabaseAdminClient()
  const { error } = await db.from('daily_ad_stats').upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'date' },
  )
  if (error) throw error

  return { date, row, errors }
}
