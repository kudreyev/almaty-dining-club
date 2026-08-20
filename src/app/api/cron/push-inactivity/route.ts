import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendPush, type PushPayload } from '@/lib/messaging/push-messaging'
import { safeLog } from '@/lib/safe-logger'

/**
 * Vercel Cron: пуш подписчикам, неактивным 7+ дней.
 * Ежедневно в 13:00 Алматы (08:00 UTC).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const INACTIVITY_DAYS = 7

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseAdminClient()
  const cutoff = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Пользователи с push-подпиской, которые не были активны 7+ дней
  const { data: inactive } = await db
    .from('push_subscriptions')
    .select('subscriber_id, profiles!inner(id, last_active_at, city)')
    .or(`last_active_at.lt.${cutoff},last_active_at.is.null`, {
      referencedTable: 'profiles',
    })

  if (!inactive?.length) {
    return NextResponse.json({ sent: 0, reason: 'no_inactive' })
  }

  const seen = new Set<string>()
  let totalSent = 0
  let totalFailed = 0

  for (const row of inactive) {
    const subscriberId = row.subscriber_id
    if (seen.has(subscriberId)) continue
    seen.add(subscriberId)

    const payload: PushPayload = {
      title: 'Вы давно не заглядывали! 👋',
      body: 'Ваши скидки ждут — используйте предложение сегодня',
      url: '/app/me',
      tag: 'inactivity-reminder',
    }

    try {
      const result = await sendPush(subscriberId, payload)
      totalSent += result.sent
      totalFailed += result.failed
    } catch (e) {
      safeLog.error('[push-inactivity] send error', { subscriberId, error: e })
      totalFailed += 1
    }
  }

  return NextResponse.json({ sent: totalSent, failed: totalFailed, inactive: seen.size })
}
