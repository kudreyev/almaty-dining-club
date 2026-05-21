import { TrialUpgradeLink } from '@/components/home/trial-upgrade-link'
import { ruDayWordAfterNumber } from '@/lib/ru-plural'

type HeroSubscriberProps = {
  planType: 'paid' | 'trial'
  endDate: string
  daysLeft?: number
  savingsAmountKzt: number
  hasRedemptions: boolean
}

function formatEndDate(endDateIso: string): string {
  const [yStr, mStr, dStr] = endDateIso.split('-')
  const date = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)))
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU').format(amount)
}

export function HeroSubscriber({
  planType,
  endDate,
  daysLeft,
  savingsAmountKzt,
  hasRedemptions,
}: HeroSubscriberProps) {
  const statusLine =
    planType === 'trial' && typeof daysLeft === 'number'
      ? `Пробный период · осталось ${daysLeft} ${ruDayWordAfterNumber(daysLeft)}`
      : `Подписка активна · до ${formatEndDate(endDate)}`

  const showSavings = hasRedemptions && savingsAmountKzt > 0

  return (
    <section className="px-5">
      <div className="mx-auto max-w-3xl py-6 md:py-8">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] text-neutral-900 md:text-[32px]">
          Куда пойдём сегодня?
        </h1>

        <p className="mt-1.5 text-sm leading-snug text-neutral-500 md:text-[15px]">
          {statusLine}
          {planType === 'trial' ? (
            <>
              {' · '}
              <TrialUpgradeLink className="font-medium text-primary underline-offset-4 hover:underline">
                Оформить полную подписку
              </TrialUpgradeLink>
            </>
          ) : null}
        </p>

        {showSavings ? (
          <p className="mt-3 inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-[13px] font-medium text-primary-dark">
            Вы сэкономили {formatMoney(savingsAmountKzt)} ₸
          </p>
        ) : null}
      </div>
    </section>
  )
}
