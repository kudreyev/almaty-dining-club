import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { syncDailyAdStats } from '@/lib/ad-stats-sync'
import { yesterdayAlmatyDate } from '@/lib/metrics-snapshot'
import { logServerError } from '@/lib/safe-errors'

/**
 * Vercel Cron: сбор рекламных метрик за вчера (Алматы) → daily_ad_stats.
 * Расписание: 07:00 Алматы = 02:00 UTC (`0 2 * * *`).
 *
 * Facebook (FB_TOKEN, FB_AD_ACCOUNT) + Метрика (METRIKA_* / YANDEX_OAUTH_TOKEN).
 * Ошибка одного источника → NULL в соответствующих полях, строка всё равно пишется.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = yesterdayAlmatyDate()

  try {
    const result = await syncDailyAdStats(date)
    return NextResponse.json({
      ok: true,
      date: result.date,
      row: result.row,
      errors: result.errors,
    })
  } catch (error) {
    logServerError('cron/ad-stats', error)
    return NextResponse.json({ error: 'Failed to sync ad stats' }, { status: 500 })
  }
}
