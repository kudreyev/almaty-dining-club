import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  almatyDayUtcBounds,
  yesterdayAlmatyDate,
} from '@/lib/metrics-snapshot'
import { notifyDailyAdSummary } from '@/lib/analytics-telegram'
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
      { count: signups },
      { count: codesIssued },
      { data: adRow },
      { count: redemptions },
    ] = await Promise.all([
      db
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'signup_completed')
        .gte('created_at', start)
        .lt('created_at', end),
      db
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'code_requested')
        .gte('created_at', start)
        .lt('created_at', end),
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

    const spend = adRow?.spend ?? null
    const signupCount = signups ?? 0
    const summary = {
      date,
      signups: signupCount,
      codesIssued: codesIssued ?? 0,
      redemptions: redemptions ?? 0,
      spend,
      costPerSignup: spend != null && signupCount > 0 ? spend / signupCount : null,
    }

    await notifyDailyAdSummary(summary)

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    logServerError('cron/analytics-digest', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
