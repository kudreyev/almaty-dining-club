import type { MetricsDailySnapshotRow } from '@/lib/metrics-snapshot'

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
    if (current.new_members_24h === 0 && previous.new_members_24h > 0) {
      alerts.push(
        `🚨 За ${dateLabel} — 0 новых регистраций (день ранее: ${previous.new_members_24h})`,
      )
    }

    const prevCodes = previous.codes_issued_24h
    if (prevCodes >= 10 && current.codes_issued_24h < prevCodes * 0.5) {
      alerts.push(
        `⚠️ Выдано кодов вдвое меньше (${dateLabel}): ${prevCodes} → ${current.codes_issued_24h}`,
      )
    }
  } else if (current.new_members_24h === 0) {
    alerts.push(
      `🚨 За ${dateLabel} — 0 новых регистраций (нет данных за предыдущий день для сравнения)`,
    )
  }

  return alerts
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
    `Гостей с телефоном: ${fmtNumber(snapshot.members_total)}${fmtDelta(snapshot.members_total, prev?.members_total)}`,
    `Новых регистраций: ${fmtNumber(snapshot.new_members_24h)}${fmtDelta(snapshot.new_members_24h, prev?.new_members_24h)}`,
    `Выдано кодов: ${fmtNumber(snapshot.codes_issued_24h)}${fmtDelta(snapshot.codes_issued_24h, prev?.codes_issued_24h)}`,
    `Использований офферов: ${fmtNumber(snapshot.redemptions_24h)}${fmtDelta(snapshot.redemptions_24h, prev?.redemptions_24h)}`,
    `WhatsApp-кликов: ${fmtNumber(snapshot.whatsapp_clicks_24h)}${fmtDelta(snapshot.whatsapp_clicks_24h, prev?.whatsapp_clicks_24h)}`,
  ]

  const topSources = topWhatsappSources(snapshot.whatsapp_clicks_by_source)
  if (topSources.length > 0) {
    lines.push('', 'Топ source (WA):', ...topSources.map((s) => `· ${s}`))
  }

  if (alerts.length > 0) {
    lines.push('', '⚠️ Алерты:', ...alerts)
  }

  return lines.join('\n')
}
