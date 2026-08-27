import { pluralizeRu } from '@/lib/ru-plural'
import { formatPriceKzt } from '@/lib/pricing'

type FreeHowItWorksProps = {
  venuesCount: number
}

function buildSteps(venuesCount: number): ReadonlyArray<{
  n: number
  title: string
  description: string
}> {
  const restaurantWord = pluralizeRu(venuesCount, [
    'ресторан',
    'ресторана',
    'ресторанов',
  ])

  return [
    {
      n: 1,
      title: 'Оформите за 1 ₸',
      description:
        'Укажите телефон и оплатите 1 ₸. Первый месяц — 1 ₸, дальше можно отменить в 2 клика.',
    },
    {
      n: 2,
      title: 'Выберите заведение',
      description: `${venuesCount} ${restaurantWord} Алматы — стейки, кофе, азиатская кухня.`,
    },
    {
      n: 3,
      title: 'Покажите код официанту',
      description: `Второе блюдо бесплатно или подарок к заказу. Подписка окупается с первого визита (${formatPriceKzt()}/мес со второго месяца).`,
    },
  ]
}

/** Три шага на промо-странице /free (акцент на первый месяц 1 ₸). */
export function FreeHowItWorks({ venuesCount }: FreeHowItWorksProps) {
  const steps = buildSteps(venuesCount)

  return (
    <section className="px-5 py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
          Как это работает
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Три шага до выгодного ужина
        </h2>

        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step) => (
            <div
              key={step.n}
              className="flex flex-col rounded-2xl border border-neutral-100 bg-white p-5 md:p-6"
            >
              <div
                className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                style={{ backgroundColor: '#FAECE7', color: '#D85A30' }}
              >
                {step.n}
              </div>
              <h3 className="text-base font-semibold leading-tight text-neutral-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
