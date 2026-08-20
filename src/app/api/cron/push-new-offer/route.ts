import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendPush, type PushPayload } from '@/lib/messaging/push-messaging'
import { safeLog } from '@/lib/safe-logger'

/**
 * Vercel Cron: пуш при появлении новых предложений за последние 24 часа.
 * Ежедневно в 12:00 Алматы (07:00 UTC).
 * Отправляет подписчикам в городе, где появилось новое предложение.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CITY_LABELS: Record<string, string> = {
  almaty: 'Алматы',
  astana: 'Астана',
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Новые активные предложения за последние 24 часа
  const { data: newOffers } = await db
    .from('offers')
    .select('id, offer_title, restaurant_id, restaurants!inner(city, restaurant_name, slug)')
    .eq('is_active', true)
    .gte('created_at', since)

  if (!newOffers?.length) {
    return NextResponse.json({ sent: 0, reason: 'no_new_offers' })
  }

  // Группируем по городу
  const offersByCity: Record<string, Array<{ title: string; restaurant: string; slug: string }>> = {}
  for (const offer of newOffers) {
    const restaurant = offer.restaurants as unknown as {
      city: string
      restaurant_name: string
      slug: string
    }
    const city = restaurant.city
    if (!offersByCity[city]) offersByCity[city] = []
    offersByCity[city].push({
      title: offer.offer_title,
      restaurant: restaurant.restaurant_name,
      slug: restaurant.slug,
    })
  }

  let totalSent = 0
  let totalFailed = 0

  for (const [city, offers] of Object.entries(offersByCity)) {
    // Подписчики в этом городе
    const { data: subscribers } = await db
      .from('push_subscriptions')
      .select('subscriber_id, profiles!inner(city)')
      .eq('profiles.city', city)

    if (!subscribers?.length) continue

    const uniqueIds = [...new Set(subscribers.map((s) => s.subscriber_id))]
    const cityLabel = CITY_LABELS[city] ?? city
    const firstOffer = offers[0]

    const payload: PushPayload = {
      title: offers.length === 1
        ? `Новое: ${firstOffer.title}`
        : `${offers.length} новых предложений в ${cityLabel}!`,
      body: offers.length === 1
        ? `В ${firstOffer.restaurant} — попробуйте сегодня`
        : `${firstOffer.restaurant} и другие — откройте каталог`,
      url: offers.length === 1 ? `/${city}/${firstOffer.slug}` : `/${city}`,
      tag: 'new-offer',
    }

    for (const subscriberId of uniqueIds) {
      try {
        const result = await sendPush(subscriberId, payload)
        totalSent += result.sent
        totalFailed += result.failed
      } catch (e) {
        safeLog.error('[push-new-offer] send error', { subscriberId, error: e })
        totalFailed += 1
      }
    }
  }

  return NextResponse.json({
    sent: totalSent,
    failed: totalFailed,
    newOffers: newOffers.length,
    cities: Object.keys(offersByCity),
  })
}
