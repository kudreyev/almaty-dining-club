import { GoalLink } from '@/components/analytics/goal-link'

type RestaurantSignupBannerProps = {
  restaurantName: string
  restaurantSlug: string
}

export function RestaurantSignupBanner({
  restaurantName,
  restaurantSlug,
}: RestaurantSignupBannerProps) {
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
          Предложения в{' '}
          <span style={{ color: '#FF8A5C' }}>{restaurantName}</span> — бесплатно
        </h2>

        <p
          className="text-white/65"
          style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '16px' }}
        >
          Без подписки и оплаты. Регистрация по номеру телефона за 30 секунд.
        </p>

        <GoalLink
          href={`/login?next=${encodeURIComponent(`/r/${restaurantSlug}`)}`}
          goal="login_cta_click"
          source="restaurant-banner"
          className="inline-block rounded-lg bg-white px-6 py-[11px] text-[14px] font-medium text-[#1a1a1a] transition-opacity hover:opacity-90"
        >
          Получить доступ бесплатно
        </GoalLink>
      </div>
    </section>
  )
}
