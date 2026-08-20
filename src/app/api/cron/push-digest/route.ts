import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendPush, type PushPayload } from '@/lib/messaging/push-messaging'
import { safeLog } from '@/lib/safe-logger'

/**
 * Vercel Cron: еженедельный пуш-дайджест подписчикам.
 * Отправляет персонализированный пуш «N предложений ждут вас в [городе]»
 * каждому подписчику, у которого есть push-подписка и активная подписка.
 *
 * Расписание: раз в неделю, четверг 12:00 Алматы (07:00 UTC).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CITY_LABELS: Record<string, string> = {
  almaty: 'Алматы',
  astana: 'Астане',
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseAdminClient()

  // Получаем подписчиков с push-подписками
  const { data: subscribers } = await db
    .from('push_subscriptions')
    .select('subscriber_id')

  if (!subscribers?.length) {
    return NextResponse.json({ sent: 0, reason: 'no_subscribers' })
  }

  const uniqueIds = [...new Set(subscribers.map((s) => s.subscriber_id))]

  // Получаем город каждого пользователя
  const { data: profiles } = await db
    .from('profiles')
    .select('id, city')
    .in('id', uniqueIds)

  if (!profiles?.length) {
    return NextResponse.json({ sent: 0, reason: 'no_profiles' })
  }

  // Считаем активные предложения по городам
  const { data: offerCounts } = await db
    .from('restaurants')
    .select('city, offers!inner(id)')
    .eq('is_active', true)
    .eq('offers.is_active', true)

  const cityOfferCount: Record<string, number> = {}
  for (const row of offerCounts ?? []) {
    const city = (row as { city: string }).city
    cityOfferCount[city] = (cityOfferCount[city] ?? 0) + 1
  }

  let totalSent = 0
  let totalFailed = 0

  for (const profile of profiles) {
    const city = profile.city ?? 'almaty'
    const count = cityOfferCount[city] ?? 0
    if (count === 0) continue

    const cityLabel = CITY_LABELS[city] ?? city
    const payload: PushPayload = {
      title: `${count} предложений в ${cityLabel} 🍽`,
      body: 'Откройте приложение и используйте одно из них сегодня!',
      url: `/${city}`,
      tag: 'weekly-digest',
    }

    try {
      const result = await sendPush(profile.id, payload)
      totalSent += result.sent
      totalFailed += result.failed
    } catch (e) {
      safeLog.error('[push-digest] send error', { userId: profile.id, error: e })
      totalFailed += 1
    }
  }

  return NextResponse.json({ sent: totalSent, failed: totalFailed, subscribers: uniqueIds.length })
}
