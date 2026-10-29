import { describe, expect, it } from 'vitest'
import { buildMetricsAlerts, formatDailyDigestMessage } from '@/lib/metrics-alerts'

const baseSnapshot = {
  date: '2026-05-21',
  members_total: 150,
  new_members_24h: 6,
  codes_issued_24h: 20,
  redemptions_24h: 5,
  whatsapp_clicks_24h: 18,
  whatsapp_clicks_by_source: { 'home-hero': 10, 'header-cta': 8 },
  computed_at: '2026-05-22T00:00:00.000Z',
}

describe('formatDailyDigestMessage', () => {
  it('includes key metrics and deltas', () => {
    const text = formatDailyDigestMessage({
      snapshot: baseSnapshot,
      previous: {
        ...baseSnapshot,
        date: '2026-05-20',
        members_total: 144,
        new_members_24h: 4,
        whatsapp_clicks_24h: 22,
      },
      alerts: [],
    })

    expect(text).toContain('сводка за 2026-05-21')
    expect(text).toContain('Гостей с телефоном: 150')
    expect(text).toContain('(+6)')
    expect(text).toContain('Выдано кодов: 20')
    expect(text).toContain('Топ source (WA):')
    expect(text).not.toContain('MRR')
    expect(text).not.toContain('⚠️ Алерты')
  })

  it('appends alerts when present', () => {
    const text = formatDailyDigestMessage({
      snapshot: baseSnapshot,
      previous: null,
      alerts: ['🚨 За 2026-05-21 — 0 новых регистраций'],
    })

    expect(text).toContain('⚠️ Алерты:')
    expect(text).toContain('0 новых регистраций')
  })
})

describe('buildMetricsAlerts', () => {
  it('flags zero signups and a code drop', () => {
    const alerts = buildMetricsAlerts(
      { ...baseSnapshot, new_members_24h: 0, codes_issued_24h: 4 },
      { ...baseSnapshot, date: '2026-05-20' },
    )
    expect(alerts.some((a) => a.includes('0 новых регистраций'))).toBe(true)
    expect(alerts.some((a) => a.includes('20 → 4'))).toBe(true)
  })
})
