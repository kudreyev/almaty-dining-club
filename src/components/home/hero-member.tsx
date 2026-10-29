import { FounderBadge } from '@/components/me/founder-badge'

type HeroMemberProps = {
  isFounder: boolean
  savingsAmountKzt: number
  hasRedemptions: boolean
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU').format(amount)
}

export function HeroMember({ isFounder, savingsAmountKzt, hasRedemptions }: HeroMemberProps) {
  const showSavings = hasRedemptions && savingsAmountKzt > 0

  return (
    <section className="px-5">
      <div className="mx-auto max-w-3xl py-6 md:py-8">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] text-neutral-900 md:text-[32px]">
          Куда пойдём сегодня?
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-snug text-neutral-500 md:text-[15px]">
          <span>Ваш доступ: бесплатно, навсегда</span>
          {isFounder ? <FounderBadge /> : null}
        </div>

        {showSavings ? (
          <p className="mt-3 inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-[13px] font-medium text-primary-dark">
            Вы сэкономили {formatMoney(savingsAmountKzt)} ₸
          </p>
        ) : null}
      </div>
    </section>
  )
}
