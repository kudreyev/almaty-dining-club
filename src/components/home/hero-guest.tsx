import { GoalLink } from '@/components/analytics/goal-link'
import { CITY_LABELS_GENITIVE, type City } from '@/lib/cities'

type HeroGuestProps = {
  city: City
}

export function HeroGuest({ city }: HeroGuestProps) {
  return (
    <section className="px-5">
      <div className="mx-auto max-w-3xl py-8 text-center md:py-12">
        <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs text-primary-dark">
          От создателей Kudafest
        </span>

        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900 md:text-5xl">
          1+1 в лучших местах {CITY_LABELS_GENITIVE[city]}.{' '}
          <span style={{ color: '#D85A30' }}>Бесплатно.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-[540px] text-sm text-neutral-700 md:text-base">
          Второе блюдо, напиток или десерт в подарок в кафе и ресторанах города.
          Без подписки, без оплаты, без приложения.
        </p>

        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <GoalLink
            href={`/login?next=${encodeURIComponent(`/${city}`)}`}
            goal="login_cta_click"
            source="home-hero"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Получить доступ бесплатно
          </GoalLink>
          <a
            href="#popular"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-6 py-3.5 text-base font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
          >
            Смотреть предложения
          </a>
        </div>

        <p className="mt-3 text-center text-xs text-neutral-500">
          Регистрация по номеру телефона за 30 секунд.
        </p>
      </div>
    </section>
  )
}
