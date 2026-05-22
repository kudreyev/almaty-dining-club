import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { computeWhatsappConversion } from '@/lib/whatsapp-analytics'

export type WeeklyDigestContext = {
  week_ending: string
  snapshots: Array<{
    date: string
    active_subscribers: number
    new_subs_24h: number
    whatsapp_clicks_24h: number
    redemptions_24h: number
    mrr_kzt: number
  }>
  whatsapp_conversion_7d: {
    subscribe_clicks: number
    new_subscriptions: number
    proxy_conversion_pct: number | null
    by_source: Array<{
      source: string
      clicks: number
      attributed_subs: number
      conversion_pct: number | null
    }>
  }
  top_restaurants_7d: Array<{ name: string; uses: number }>
}

function isoDateUtc(daysOffset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysOffset)
  return d.toISOString().slice(0, 10)
}

function isoTimestamp(daysOffset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysOffset)
  return d.toISOString()
}

export async function buildWeeklyDigestContext(): Promise<WeeklyDigestContext> {
  const admin = createSupabaseAdminClient()
  const sinceDate = isoDateUtc(-7)
  const sinceTs = isoTimestamp(-7)

  const [snapshotsRes, clicksRes, subsRes, redemptionsRes] = await Promise.all([
    admin
      .from('metrics_daily_snapshot')
      .select(
        'date, active_subscribers, new_subs_24h, whatsapp_clicks_24h, redemptions_24h, mrr_kzt',
      )
      .gte('date', sinceDate)
      .order('date', { ascending: true }),
    admin
      .from('analytics_events')
      .select('user_id, created_at, meta')
      .eq('event_name', 'whatsapp_click')
      .gte('created_at', sinceTs),
    admin.from('subscriptions').select('user_id, created_at').gte('created_at', sinceTs),
    admin
      .from('redemptions')
      .select('restaurant_id')
      .gte('redeemed_at', sinceTs),
  ])

  if (snapshotsRes.error) throw snapshotsRes.error
  if (clicksRes.error) throw clicksRes.error
  if (subsRes.error) throw subsRes.error
  if (redemptionsRes.error) throw redemptionsRes.error

  const conversion = computeWhatsappConversion({
    clicks: clicksRes.data ?? [],
    newSubscriptions: subsRes.data ?? [],
  })

  const counts = new Map<string, number>()
  for (const row of redemptionsRes.data ?? []) {
    counts.set(row.restaurant_id, (counts.get(row.restaurant_id) ?? 0) + 1)
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  let topRestaurants: Array<{ name: string; uses: number }> = []
  if (topIds.length > 0) {
    const namesRes = await admin
      .from('restaurants')
      .select('id, restaurant_name')
      .in(
        'id',
        topIds.map(([id]) => id),
      )
    if (namesRes.error) throw namesRes.error
    const nameById = new Map((namesRes.data ?? []).map((r) => [r.id, r.restaurant_name]))
    topRestaurants = topIds.map(([id, uses]) => ({
      name: nameById.get(id) ?? '—',
      uses,
    }))
  }

  const snapshots = (snapshotsRes.data ?? []).map((row) => ({
    date: row.date,
    active_subscribers: row.active_subscribers,
    new_subs_24h: row.new_subs_24h,
    whatsapp_clicks_24h: row.whatsapp_clicks_24h,
    redemptions_24h: row.redemptions_24h,
    mrr_kzt: row.mrr_kzt,
  }))

  return {
    week_ending: isoDateUtc(-1),
    snapshots,
    whatsapp_conversion_7d: {
      subscribe_clicks: conversion.subscribeClicks,
      new_subscriptions: conversion.newSubscriptions,
      proxy_conversion_pct: conversion.proxyConversionPct,
      by_source: conversion.bySource.map((row) => ({
        source: row.source,
        clicks: row.clicks,
        attributed_subs: row.attributedSubs,
        conversion_pct: row.conversionPct,
      })),
    },
    top_restaurants_7d: topRestaurants,
  }
}

export function buildWeeklyDigestPrompt(ctx: WeeklyDigestContext): string {
  return `Ты — продуктовый аналитик Kudaclub (подписка на скидки в ресторанах Алматы, 1990 ₸/мес).

Вот агрегированные данные за неделю (JSON). Все числа уже посчитаны — не пересчитывай их.

${JSON.stringify(ctx, null, 2)}

Дай ответ на русском, в Markdown для Telegram (без таблиц):
1. Три ключевых наблюдения за неделю.
2. Два риска или провала, требующих действия.
3. Три гипотезы для тестов на следующую неделю.

Кратко, по делу, без воды.`
}

export function truncateForTelegram(text: string, maxLen = 4000): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 20)}\n\n… (обрезано)`
}
