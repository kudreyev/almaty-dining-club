import { describe, expect, it } from 'vitest'
import { computeWhatsappConversion } from '@/lib/whatsapp-analytics'

describe('computeWhatsappConversion', () => {
  it('attributes last subscribe click within 7 days', () => {
    const result = computeWhatsappConversion({
      clicks: [
        {
          user_id: 'u1',
          created_at: '2026-05-01T10:00:00.000Z',
          meta: { source: 'home-hero' },
        },
        {
          user_id: 'u1',
          created_at: '2026-05-02T10:00:00.000Z',
          meta: { source: 'pricing-page' },
        },
      ],
      newSubscriptions: [
        {
          user_id: 'u1',
          created_at: '2026-05-03T10:00:00.000Z',
        },
      ],
    })

    expect(result.subscribeClicks).toBe(2)
    expect(result.newSubscriptions).toBe(1)
    expect(result.proxyConversionPct).toBe(50)
    expect(result.bySource).toEqual([
      {
        source: 'home-hero',
        clicks: 1,
        attributedSubs: 0,
        conversionPct: 0,
      },
      {
        source: 'pricing-page',
        clicks: 1,
        attributedSubs: 1,
        conversionPct: 100,
      },
    ])
  })

  it('ignores support clicks in conversion table', () => {
    const result = computeWhatsappConversion({
      clicks: [
        {
          user_id: 'u1',
          created_at: '2026-05-01T10:00:00.000Z',
          meta: { source: 'footer-support' },
        },
      ],
      newSubscriptions: [],
    })

    expect(result.subscribeClicks).toBe(0)
    expect(result.bySource).toEqual([])
  })
})
