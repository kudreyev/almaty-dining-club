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

  return (
    <section className="px-5">
      <div className="mx-auto max-w-3xl py-6 md:py-8">
        <p className="text-2xl font-semibold leading-tight tracking-[-0.01em] text-neutral-900 md:text-3xl">
          С возвращением
        </p>

        <p className="mt-2 text-sm text-neutral-600 md:text-base">
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

        {hasRedemptions && savingsAmountKzt > 0 ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-light px-3.5 py-1.5 text-sm text-primary-dark">
            <span aria-hidden="true">·</span>
            Вы сэкономили {formatMoney(savingsAmountKzt)} ₸
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            Выберите заведение для первого визита.
          </p>
        )}

        <p className="mt-5 text-base font-medium text-neutral-900">
          Куда пойдём сегодня?
        </p>
      </div>
    </section>
  )
}
