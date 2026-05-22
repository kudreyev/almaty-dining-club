import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { buildMetricsAlerts, formatMetricsAlertMessage } from '@/lib/metrics-alerts'
import {
  computeDailySnapshot,
  loadSnapshotByDate,
  previousAlmatyDate,
  upsertDailySnapshot,
  yesterdayAlmatyDate,
} from '@/lib/metrics-snapshot'
import { sendTelegramMessage } from '@/lib/telegram'
import { logServerError } from '@/lib/safe-errors'

/**
 * Vercel Cron: ежедневный снимок метрик + Telegram-алерты (Слой 3).
 *
 * Расписание: 03:30 Алматы (30 22 * * * UTC), после metrica-sync.
 *
 * 1. Считает метрики за вчера (календарный день Алматы).
 * 2. Upsert в metrics_daily_snapshot.
 * 3. Сравнивает с предыдущим днём → алерты в Telegram (если настроен бот).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return unauthorized()

  const date = yesterdayAlmatyDate()
  const prevDate = previousAlmatyDate(date)

  let snapshot
  try {
    snapshot = await computeDailySnapshot(date)
    await upsertDailySnapshot(snapshot)
  } catch (error) {
    logServerError('cron/daily-snapshot:compute', error)
    return NextResponse.json({ error: 'Failed to compute snapshot' }, { status: 500 })
  }

  let previous = null
  try {
    previous = await loadSnapshotByDate(prevDate)
  } catch (error) {
    logServerError('cron/daily-snapshot:loadPrevious', error)
  }

  const alerts = buildMetricsAlerts(
    { ...snapshot, computed_at: new Date().toISOString() },
    previous,
  )

  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
  )

  let telegramResult: Awaited<ReturnType<typeof sendTelegramMessage>> = {
    sent: false,
    reason: 'not_configured',
  }

  if (telegramConfigured && alerts.length > 0) {
    telegramResult = await sendTelegramMessage(formatMetricsAlertMessage(alerts))
  }

  return NextResponse.json({
    date,
    snapshot,
    previous_date: prevDate,
    previous_found: Boolean(previous),
    alerts,
    telegram: {
      configured: telegramConfigured,
      alerts_sent: telegramResult.sent,
    },
  })
}
