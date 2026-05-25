import type { MetricsDailySnapshotRow } from '@/lib/metrics-snapshot'

const ACTIVATION_ERROR_SOURCES = ['activate-error', 'activate-card-error'] as const

function sourceClicks(
  snapshot: MetricsDailySnapshotRow,
  source: string,
): number {
  return snapshot.whatsapp_clicks_by_source[source] ?? 0
}

function sumSourceClicks(
  snapshot: MetricsDailySnapshotRow,
  sources: readonly string[],
): number {
  return sources.reduce((sum, s) => sum + sourceClicks(snapshot, s), 0)
}

/**
 * Правила алертов Слоя 3 — сравнение вчера vs позавчера (по снимкам).
 * Возвращает массив строк для Telegram; пустой — всё в норме.
 */
export function buildMetricsAlerts(
  current: MetricsDailySnapshotRow,
  previous: MetricsDailySnapshotRow | null,
): string[] {
  const alerts: string[] = []
  const dateLabel = current.date

  if (previous) {
    const prevWa = previous.whatsapp_clicks_24h
    const currWa = current.whatsapp_clicks_24h
    if (prevWa > 0 && currWa < prevWa * 0.5) {
      alerts.push(
        `⚠️ Клики WhatsApp упали более чем в 2 раза (${dateLabel}): ${prevWa} → ${currWa}`,
      )
    }

    if (current.new_subs_24h === 0 && previous.new_subs_24h > 0) {
      alerts.push(
        `🚨 За ${dateLabel} — 0 новых подписок (день ранее: ${previous.new_subs_24h})`,
      )
    }
  } else if (current.new_subs_24h === 0) {
    alerts.push(`🚨 За ${dateLabel} — 0 новых подписок (нет данных за предыдущий день для сравнения)`)
  }

  const activationErrors = sumSourceClicks(current, ACTIVATION_ERROR_SOURCES)
  if (activationErrors > 5) {
    alerts.push(
      `🛠 Ошибки активации в WhatsApp за ${dateLabel}: ${activationErrors} кликов (activate-error / activate-card-error) — проверьте /activate`,
    )
  }

  return alerts
}

export function formatMetricsAlertMessage(alerts: string[]): string {
  return ['Kudaclub · ежедневные алерты', '', ...alerts].join('\n')
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function fmtDelta(current: number, previous: number | undefined): string {
  if (previous === undefined) return ''
  const diff = current - previous
  if (diff === 0) return ' (=)'
  const sign = diff > 0 ? '+' : ''
  return ` (${sign}${fmtNumber(diff)})`
}

function topWhatsappSources(bySource: Record<string, number>, limit = 3): string[] {
  return Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([source, clicks]) => `${source}: ${fmtNumber(clicks)}`)
}

/** Ежедневная сводка для Telegram (всегда, не только при алертах). */
export function formatDailyDigestMessage(args: {
  snapshot: MetricsDailySnapshotRow
  previous: MetricsDailySnapshotRow | null
  alerts: string[]
}): string {
  const { snapshot, previous, alerts } = args
  const prev = previous ?? undefined

  const lines = [
    `Kudaclub · сводка за ${snapshot.date}`,
    '',
    `Активных: ${fmtNumber(snapshot.active_subscribers)} (paid: ${fmtNumber(snapshot.active_paid_subscribers)})${fmtDelta(snapshot.active_subscribers, prev?.active_subscribers)}`,
    `MRR: ${fmtNumber(snapshot.mrr_kzt)} ₸`,
    `Новых подписок: ${fmtNumber(snapshot.new_subs_24h)} (paid: ${fmtNumber(snapshot.new_paid_subs_24h)})${fmtDelta(snapshot.new_subs_24h, prev?.new_subs_24h)}`,
    `WhatsApp-кликов: ${fmtNumber(snapshot.whatsapp_clicks_24h)}${fmtDelta(snapshot.whatsapp_clicks_24h, prev?.whatsapp_clicks_24h)}`,
    `Использований офферов: ${fmtNumber(snapshot.redemptions_24h)}${fmtDelta(snapshot.redemptions_24h, prev?.redemptions_24h)}`,
    `Истекают в 7 дней: ${fmtNumber(snapshot.expiring_next_7d)}`,
  ]

  if (snapshot.retention_30d_pct != null) {
    lines.push(`Retention 30d: ${snapshot.retention_30d_pct}%`)
  }

  const topSources = topWhatsappSources(snapshot.whatsapp_clicks_by_source)
  if (topSources.length > 0) {
    lines.push('', 'Топ source (WA):', ...topSources.map((s) => `· ${s}`))
  }

  if (alerts.length > 0) {
    lines.push('', '⚠️ Алерты:', ...alerts)
  }

  return lines.join('\n')
}
