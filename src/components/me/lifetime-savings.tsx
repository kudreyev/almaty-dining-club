import { formatPriceKzt } from '@/lib/pricing'
import { pluralizeRu } from '@/lib/ru-plural'

type Props = {
  amountKzt: number
  redemptionsCount: number
}

/** Экономия за всё время по redemptions (getUserSavings). */
export function LifetimeSavings({ amountKzt, redemptionsCount }: Props) {
  const activationsWord = pluralizeRu(redemptionsCount, [
    'активации',
    'активациям',
    'активациям',
  ])

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[13px] font-medium text-neutral-500">За всё время</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
        Вы сэкономили {formatPriceKzt(amountKzt)}
      </p>
      {redemptionsCount > 0 ? (
        <p className="mt-1.5 text-[12px] leading-[1.4] text-neutral-400">
          По {redemptionsCount} {activationsWord}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] leading-[1.4] text-neutral-400">
          Активируйте оффер — экономия появится здесь
        </p>
      )}
    </section>
  )
}
