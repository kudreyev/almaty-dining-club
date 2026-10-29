import { GoalLink } from '@/components/analytics/goal-link'
import { buildPartnerWhatsAppUrl } from '@/lib/whatsapp'

export function WhyFreeSection() {
  return (
    <section className="px-5 py-8 md:py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-primary-light px-6 py-8 text-center md:px-10">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl">
          Почему бесплатно?
        </h2>
        <p className="mx-auto mt-3 max-w-[520px] text-sm leading-relaxed text-neutral-700 md:text-base">
          Мы хотим, чтобы вы открывали лучшие места города. Для вас KudaClub бесплатный —
          без подписок и скрытых платежей.
        </p>
      </div>
    </section>
  )
}

export function FormerSubscribersSection() {
  return (
    <section className="px-5 py-4 md:py-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white px-6 py-6 md:px-8">
        <h2 className="text-base font-semibold text-neutral-900 md:text-lg">
          Были с нами на подписке?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Списания отключены, а вы теперь основатель клуба: все предложения доступны
          бесплатно, новые заведения вы увидите первыми.
        </p>
      </div>
    </section>
  )
}

export function ForVenuesSection() {
  return (
    <section className="px-5 py-8 md:py-12">
      <div className="mx-auto max-w-3xl rounded-2xl bg-[#1a1a1a] px-6 py-8 text-center md:px-10">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#FF8A5C]">
          Для заведений
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
          Хотите больше гостей? Подключение бесплатное.
        </h2>
        <GoalLink
          href={buildPartnerWhatsAppUrl()}
          goal="partner_cta_click"
          source="home-venues"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-medium text-[#1a1a1a] transition-opacity hover:opacity-90"
        >
          Стать партнёром
        </GoalLink>
      </div>
    </section>
  )
}

const FAQ = [
  { q: 'Это правда бесплатно?', a: 'Да. Никаких подписок и списаний.' },
  {
    q: 'Зачем регистрация?',
    a: 'Чтобы код был только у вас и чтобы заведение видело, что вы реальный гость.',
  },
  {
    q: 'Сколько раз можно пользоваться?',
    a: 'Сколько угодно. Одновременно у вас может быть один активный код, он действует 10 минут.',
  },
  {
    q: 'Я платил за подписку, что теперь?',
    a: 'Автосписания отключены, доступ остаётся бесплатным.',
  },
  { q: 'Нужно ли приложение?', a: 'Нет, всё работает на сайте.' },
] as const

export function HomeFaq() {
  return (
    <section className="px-5 py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Частые вопросы
        </h2>
        <div className="mt-6 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-neutral-900">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-lg leading-none text-neutral-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
