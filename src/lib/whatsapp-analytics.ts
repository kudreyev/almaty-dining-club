/** Саппортные source — не участвуют в подписной воронке. */
export const SUPPORT_WHATSAPP_SOURCES = new Set([
  'footer-support',
  'support-page',
  'support-phone',
  'activate-error',
  'activate-already-used',
  'activate-card-error',
  'activate-card-intro',
])

export const ATTRIBUTION_WINDOW_MS = 7 * 86_400_000

export type WhatsappClickRow = {
  user_id: string | null
  created_at: string
  meta: Record<string, unknown> | null
}

export type SubscriptionCreatedRow = {
  user_id: string
  created_at: string
}

export type SourceConversionRow = {
  source: string
  clicks: number
  attributedSubs: number
  conversionPct: number | null
}

export type WhatsappConversionStats = {
  subscribeClicks: number
  newSubscriptions: number
  /** Грубая метрика: новые подписки / подписные клики (без per-user атрибуции). */
  proxyConversionPct: number | null
  bySource: SourceConversionRow[]
}

function parseSource(meta: Record<string, unknown> | null): string {
  const raw = meta?.source
  return typeof raw === 'string' && raw.length > 0 ? raw : '(без source)'
}

function isSubscribeClick(source: string): boolean {
  return !SUPPORT_WHATSAPP_SOURCES.has(source)
}

/** Last-touch атрибуция: подписка → последний подписной клик за 7 дней до неё. */
export function computeWhatsappConversion(args: {
  clicks: WhatsappClickRow[]
  newSubscriptions: SubscriptionCreatedRow[]
}): WhatsappConversionStats {
  const { clicks, newSubscriptions } = args

  const clicksBySource = new Map<string, number>()
  let subscribeClicks = 0

  const subscribeClicksByUser = new Map<string, WhatsappClickRow[]>()

  for (const click of clicks) {
    const source = parseSource(click.meta)
    clicksBySource.set(source, (clicksBySource.get(source) ?? 0) + 1)
    if (!isSubscribeClick(source)) continue

    subscribeClicks++
    if (!click.user_id) continue

    const list = subscribeClicksByUser.get(click.user_id) ?? []
    list.push(click)
    subscribeClicksByUser.set(click.user_id, list)
  }

  const attributedBySource = new Map<string, number>()

  for (const sub of newSubscriptions) {
    const userClicks = subscribeClicksByUser.get(sub.user_id)
    if (!userClicks?.length) continue

    const subMs = new Date(sub.created_at).getTime()
    let lastClick: WhatsappClickRow | null = null
    let lastClickMs = -Infinity

    for (const click of userClicks) {
      const clickMs = new Date(click.created_at).getTime()
      if (clickMs > subMs) continue
      if (subMs - clickMs > ATTRIBUTION_WINDOW_MS) continue
      if (clickMs >= lastClickMs) {
        lastClick = click
        lastClickMs = clickMs
      }
    }

    if (!lastClick) continue
    const source = parseSource(lastClick.meta)
    attributedBySource.set(source, (attributedBySource.get(source) ?? 0) + 1)
  }

  const allSources = new Set([...clicksBySource.keys(), ...attributedBySource.keys()])
  const bySource: SourceConversionRow[] = Array.from(allSources)
    .filter((source) => isSubscribeClick(source))
    .map((source) => {
      const sourceClicks = clicksBySource.get(source) ?? 0
      const attributedSubs = attributedBySource.get(source) ?? 0
      return {
        source,
        clicks: sourceClicks,
        attributedSubs,
        conversionPct:
          sourceClicks > 0 ? Math.round((attributedSubs / sourceClicks) * 1000) / 10 : null,
      }
    })
    .sort((a, b) => b.clicks - a.clicks)

  const newSubscriptionsCount = newSubscriptions.length

  return {
    subscribeClicks,
    newSubscriptions: newSubscriptionsCount,
    proxyConversionPct:
      subscribeClicks > 0
        ? Math.round((newSubscriptionsCount / subscribeClicks) * 1000) / 10
        : null,
    bySource,
  }
}

export type MetricaSourceRow = {
  source: string
  achievements: number
}

/** Агрегация строк metrica_goals_daily по source. */
export function aggregateMetricaBySource(
  rows: Array<{ source: string; achievements: number }>,
): MetricaSourceRow[] {
  const bySource = new Map<string, number>()
  for (const row of rows) {
    const source = row.source.length > 0 ? row.source : '(без source)'
    bySource.set(source, (bySource.get(source) ?? 0) + row.achievements)
  }
  return Array.from(bySource.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([source, achievements]) => ({ source, achievements }))
}
