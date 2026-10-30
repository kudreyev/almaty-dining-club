export type DiscountCodeProps = {
  tokenCode: string | null
  status: string | null
  expiresAt: string | null
  restaurantName: string | null
  offerTitle: string | null
}

/** Активный код из базы. Офлайн код не показываем: старый код мог быть уже погашен или истечь. */
export function DiscountCodeCard(props: DiscountCodeProps) {
  if (!props.tokenCode || props.status !== 'active' || !props.expiresAt) return null

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white px-5 py-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-neutral-400">
        Код скидки
      </p>
      <p className="mt-3 text-4xl font-semibold tracking-[0.22em] tabular-nums text-neutral-900 sm:text-5xl">
        {props.tokenCode}
      </p>
      {props.restaurantName || props.offerTitle ? (
        <p className="mt-2 text-[13px] leading-[1.4] text-neutral-500">
          {[props.restaurantName, props.offerTitle].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <p className="mt-2 text-[12px] text-neutral-400">Покажите код сотруднику заведения</p>
    </section>
  )
}
