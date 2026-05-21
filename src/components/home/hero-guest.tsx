import { WhatsappGoalLink } from '@/components/analytics/whatsapp-goal-link'

type HeroGuestProps = {
  venuesCount: number
}

export function HeroGuest({ venuesCount }: HeroGuestProps) {
  return (
    <section className="px-5">
      <div className="mx-auto max-w-3xl py-8 text-center md:py-12">
        <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs text-primary-dark">
          От создателей Kudafest · Алматы
        </span>

        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900 md:text-5xl">
          Подписка на скидки в ресторанах{' '}
          <span style={{ color: '#D85A30' }}>Алматы</span>
        </h1>

        <p className="mx-auto mt-4 max-w-[520px] text-sm text-neutral-700 md:text-base">
          Платите <span className="font-semibold">1 990 ₸ в месяц</span> — и в{' '}
          {venuesCount} заведениях получаете второе блюдо бесплатно или подарок
          к заказу.
        </p>

        <p className="mx-auto mt-3 max-w-[480px] text-sm text-neutral-500">
          Как абонемент в спортзал — только для ресторанов.
        </p>

        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <WhatsappGoalLink
            source="home-hero"
            extraGoal="subscribe_click_home"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Попробовать за 1 990 ₸
          </WhatsappGoalLink>
          <a
            href="#venues"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-6 py-3.5 text-base font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
          >
            Смотреть заведения
          </a>
        </div>

        <ul className="mt-5 flex flex-col items-center gap-2 text-xs text-neutral-500 sm:flex-row sm:justify-center sm:gap-6">
          <li className="inline-flex items-center gap-1.5">
            <CheckIcon />
            1 визит окупает подписку
          </li>
          <li className="inline-flex items-center gap-1.5">
            <CheckIcon />
            Отмена в любой момент
          </li>
        </ul>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#0F6E56"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
