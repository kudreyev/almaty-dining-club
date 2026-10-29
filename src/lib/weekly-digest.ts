import { createCustomerMetricsScope } from '@/lib/customer-metrics'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type WeeklyDigestContext = {
  week_ending: string
  snapshots: Array<{
    date: string
    members_total: number
    new_members_24h: number
    codes_issued_24h: number
    redemptions_24h: number
    whatsapp_clicks_24h: number
  }>
  funnel_7d: {
    signups: number
    codes_requested: number
    redemptions: number
    guests_with_code: number
    guests_redeemed: number
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
  const scope = await createCustomerMetricsScope(admin)
  const sinceDate = isoDateUtc(-7)
  const sinceTs = isoTimestamp(-7)

  const [snapshotsRes, eventsRes, redemptionsRes] = await Promise.all([
    admin
      .from('metrics_daily_snapshot')
      .select(
        'date, members_total, new_members_24h, codes_issued_24h, redemptions_24h, whatsapp_clicks_24h',
      )
      .gte('date', sinceDate)
      .order('date', { ascending: true }),
    admin
      .from('analytics_events')
      .select('event_name, user_id')
      .in('event_name', ['signup_completed', 'code_requested'])
      .gte('created_at', sinceTs),
    scope.applyUserIdExclusion(
      admin
        .from('redemptions')
        .select('restaurant_id, user_id')
        .gte('redeemed_at', sinceTs),
    ),
  ])

  if (snapshotsRes.error) throw snapshotsRes.error
  if (eventsRes.error) throw eventsRes.error
  if (redemptionsRes.error) throw redemptionsRes.error

  const events = scope.filterNullableUserRows(eventsRes.data ?? [])
  const codeEvents = events.filter((e) => e.event_name === 'code_requested')
  const redemptions = scope.filterUserRows(redemptionsRes.data ?? [])

  const counts = new Map<string, number>()
  for (const row of redemptions) {
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

  return {
    week_ending: isoDateUtc(-1),
    snapshots: snapshotsRes.data ?? [],
    funnel_7d: {
      signups: events.filter((e) => e.event_name === 'signup_completed').length,
      codes_requested: codeEvents.length,
      redemptions: redemptions.length,
      guests_with_code: new Set(codeEvents.map((e) => e.user_id)).size,
      guests_redeemed: new Set(redemptions.map((r) => r.user_id)).size,
    },
    top_restaurants_7d: topRestaurants,
  }
}

export function buildWeeklyDigestPrompt(ctx: WeeklyDigestContext): string {
  return `Ты — продуктовый аналитик KudaClub: бесплатный для гостей сервис предложений 1+1 в кафе и ресторанах Алматы. Приводим гостей в заведения-партнёры.

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
