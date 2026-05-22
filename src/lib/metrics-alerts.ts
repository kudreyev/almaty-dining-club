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
