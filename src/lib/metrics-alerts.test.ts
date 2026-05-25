import { describe, expect, it } from 'vitest'
import { formatDailyDigestMessage } from '@/lib/metrics-alerts'

const baseSnapshot = {
  date: '2026-05-21',
  active_subscribers: 15,
  active_paid_subscribers: 12,
  mrr_kzt: 23880,
  new_subs_24h: 2,
  new_paid_subs_24h: 1,
  redemptions_24h: 5,
  whatsapp_clicks_24h: 18,
  whatsapp_clicks_by_source: { 'home-hero': 10, 'header-cta': 8 },
  retention_30d_pct: 41,
  expiring_next_7d: 3,
  computed_at: '2026-05-22T00:00:00.000Z',
}

describe('formatDailyDigestMessage', () => {
  it('includes key metrics and deltas', () => {
    const text = formatDailyDigestMessage({
      snapshot: baseSnapshot,
      previous: {
        ...baseSnapshot,
        date: '2026-05-20',
        active_subscribers: 13,
        new_subs_24h: 1,
        whatsapp_clicks_24h: 22,
      },
      alerts: [],
    })

    expect(text).toContain('сводка за 2026-05-21')
    expect(text).toContain('Активных: 15')
    expect(text).toContain('(+2)')
    expect(text).toContain('Топ source (WA):')
    expect(text).not.toContain('⚠️ Алерты')
  })

  it('appends alerts when present', () => {
    const text = formatDailyDigestMessage({
      snapshot: baseSnapshot,
      previous: null,
      alerts: ['🚨 За 2026-05-21 — 0 новых подписок'],
    })

    expect(text).toContain('⚠️ Алерты:')
    expect(text).toContain('0 новых подписок')
  })
})
