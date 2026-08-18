import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  almatyDayUtcBounds,
  yesterdayAlmatyDate,
} from '@/lib/metrics-snapshot'
import {
  aggregateTopPromos,
  aggregateTopSources,
  notifyDailyAdSummary,
} from '@/lib/analytics-telegram'
import { isPaidMedium } from '@/lib/ttp-analytics-ledger'
import { logServerError } from '@/lib/safe-errors'

/**
 * Vercel Cron: Telegram-сводка по аналитике за вчера.
 * Расписание: 09:00 Алматы = 04:00 UTC (`0 4 * * *`).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = yesterdayAlmatyDate()
  const { start, end } = almatyDayUtcBounds(date)
  const db = createSupabaseAdminClient()

  try {
    const [
      { count: newSubs },
      { data: newRows },
      { count: cancelled },
      { data: adRow },
      { count: redemptions },
    ] = await Promise.all([
      db
        .from('subscribers')
        .select('id', { count: 'exact', head: true })
        .gte('subscribed_at', start)
        .lt('subscribed_at', end),
      db
        .from('subscribers')
        .select('utm_source, utm_medium, promo_code')
        .gte('subscribed_at', start)
        .lt('subscribed_at', end),
      db
        .from('subscribers')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('cancelled_at', start)
        .lt('cancelled_at', end),
      db
        .from('daily_ad_stats')
        .select('spend')
        .eq('date', date)
        .maybeSingle<{ spend: number | null }>(),
      db
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .gte('redeemed_at', start)
        .lt('redeemed_at', end),
    ])

    const paidNew = (newRows ?? []).filter((r) =>
      isPaidMedium(r.utm_medium as string | null),
    ).length
    const spend = adRow?.spend ?? null
    const cac = spend != null && paidNew > 0 ? spend / paidNew : null

    const summary = {
      date,
      newSubs: newSubs ?? 0,
      cancelled: cancelled ?? 0,
      spend,
      paidNew,
      cac,
      topSources: aggregateTopSources(newRows ?? []),
      topPromos: aggregateTopPromos(newRows ?? []),
      redemptions: redemptions ?? 0,
    }

    await notifyDailyAdSummary(summary)

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    logServerError('cron/analytics-digest', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
