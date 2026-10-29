const STEPS = [
  { n: 1, text: 'Зарегистрируйтесь по номеру телефона.' },
  { n: 2, text: 'Выберите заведение и нажмите «Получить код».' },
  { n: 3, text: 'Покажите код официанту и получите бонус.' },
] as const

export function HowItWorks() {
  return (
    <section className="px-5 py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
          Как это работает
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Три шага до ужина 1+1
        </h2>

        <ol className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="flex flex-col rounded-2xl border border-neutral-100 bg-white p-5 md:p-6"
            >
              <div
                className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                style={{ backgroundColor: '#FAECE7', color: '#D85A30' }}
              >
                {step.n}
              </div>
              <p className="text-base font-medium leading-snug text-neutral-900">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
