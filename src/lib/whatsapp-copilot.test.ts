import { describe, expect, it } from 'vitest'
import { classifyIntent, buildTemplateDraft } from '@/lib/whatsapp-copilot'

describe('whatsapp-copilot', () => {
  it('classifies renew intent', () => {
    expect(classifyIntent('Хочу продлить подписку Kudaclub')).toBe('renew')
  })

  it('builds subscribe template for hot lead', () => {
    const text = buildTemplateDraft(
      'subscribe',
      {
        phone_e164: '+77001234567',
        is_registered: false,
        has_active_subscription: false,
        subscription_status: null,
        subscription_end_date: null,
        total_subscriptions: 0,
        redemptions_count: 0,
        recent_restaurants: [],
        trial_used: null,
      },
      'Здравствуйте! Хочу подписку Kudaclub. Хочу попробовать Антрекот',
    )
    expect(text).toContain('Антрекот')
    expect(text).toContain('Kaspi')
  })
})
