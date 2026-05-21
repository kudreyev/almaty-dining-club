export function EconomicsSection() {
  return (
    <section className="px-5 py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <p
          className="text-[11px] font-medium uppercase tracking-wider text-primary"
        >
          Экономика подписки
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Подписка окупается с первого визита
        </h2>
        <p className="mt-3 max-w-[640px] text-sm text-neutral-600 md:text-base">
          Подписка стоит 1 990 ₸. Один ужин со скидкой 2-за-1 экономит в среднем
          2 500 ₸. Всё, что дальше — в плюс.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Без Kudaclub
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
              6 000 ₸
            </p>
            <p className="mt-1.5 text-sm text-neutral-600">Ужин на двоих</p>
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: '#FAECE7',
              borderColor: 'rgba(216, 90, 48, 0.15)',
            }}
          >
            <p
              className="text-[11px] font-medium uppercase tracking-wider"
              style={{ color: '#993C1D' }}
            >
              С Kudaclub
            </p>
            <p
              className="mt-3 text-3xl font-semibold tracking-tight"
              style={{ color: '#0F6E56' }}
            >
              3 500 ₸
            </p>
            <p className="mt-1.5 text-sm text-neutral-700">
              Тот же ужин со скидкой
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Экономия
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
              2 500 ₸
            </p>
            <p className="mt-1.5 text-sm text-neutral-600">С каждого визита</p>
          </div>
        </div>
      </div>
    </section>
  )
}
