import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <section className="rounded-[2rem] border border-gray-200 bg-white px-8 py-16 shadow-sm md:px-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
          Алматы
        </p>

        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Подписка с офферами 1+1 и комплиментами в ресторанах города
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          Выбирай заведение, активируй оффер и получай больше удовольствия от любимых мест в Алматы.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/almaty"
            className="inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white"
          >
            Смотреть рестораны
          </Link>

          <Link
            href="/pricing"
            className="inline-flex rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black"
          >
            Узнать о подписке
          </Link>
        </div>
      </section>
    </main>
  )
}