'use client'

import { WhatsappGoalLink } from '@/components/analytics/whatsapp-goal-link'
import { venueCtaSource } from '@/lib/whatsapp'

type RestaurantSubscribeBannerProps = {
  restaurantName: string
  restaurantSlug: string
  maxSavingsLabel: string | null
}

export function RestaurantSubscribeBanner({
  restaurantName,
  restaurantSlug,
  maxSavingsLabel,
}: RestaurantSubscribeBannerProps) {
  const subtitle = maxSavingsLabel
    ? `Подписка Kudaclub — 1 990 ₸/мес. Один ужин здесь экономит ${maxSavingsLabel}.`
    : 'Подписка Kudaclub — 1 990 ₸/мес. Окупается первым визитом.'

  return (
    <section className="px-5" style={{ marginBottom: '24px' }}>
      <div
        className="text-center"
        style={{
          background: '#1a1a1a',
          borderRadius: '8px',
          padding: '24px 20px',
        }}
      >
        <h2
          className="font-medium text-white"
          style={{ fontSize: '16px', marginBottom: '6px' }}
        >
          Получи доступ к офферам в{' '}
          <span style={{ color: '#FF8A5C' }}>{restaurantName}</span>
        </h2>

        <p
          className="text-white/65"
          style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '16px' }}
        >
          {subtitle}
        </p>

        <WhatsappGoalLink
          source={venueCtaSource(restaurantSlug)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            background: '#ffffff',
            color: '#1a1a1a',
            fontSize: '14px',
            fontWeight: 500,
            padding: '11px 24px',
            borderRadius: '8px',
            border: 'none',
            transition: 'opacity 150ms ease',
            textDecoration: 'none',
          }}
        >
          Попробовать за 1 990 ₸
        </WhatsappGoalLink>
      </div>
    </section>
  )
}
