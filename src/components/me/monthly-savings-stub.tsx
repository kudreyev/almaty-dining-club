/**
 * Заглушка блока «Вы сэкономили X ₸ в этом месяце».
 *
 * TODO(analytics): когда появится помесячный расчёт по redemptions
 * (estimated_value за календарный месяц) — заменить на реальные данные.
 * Сейчас lifetime savings есть в getUserSavings(), месячного среза нет.
 */

export function MonthlySavingsStub() {
  return (
    <section className="mb-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-5 py-5">
      <p className="text-[13px] font-medium text-neutral-500">В этом месяце</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
        Вы сэкономили — ₸
      </p>
      <p className="mt-1.5 text-[12px] leading-[1.4] text-neutral-400">
        Скоро посчитаем по вашим активациям
      </p>
    </section>
  )
}
