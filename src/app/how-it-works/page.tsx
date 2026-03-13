import Link from 'next/link'

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <section className="rounded-[2rem] border border-gray-200 bg-white px-8 py-14 shadow-sm md:px-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
          Алматы · Подписка
        </p>

        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Офферы 1+1 и комплименты в ресторанах — по одной подписке
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          Выбирай заведение, активируй оффер и покажи код персоналу. Всё просто — без купонов и распечаток.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">1) Подписка</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Оформи доступ к партнёрам в Алматы. После подтверждения оплаты подписка активируется.
            </p>
          </div>

          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">2) Активируй оффер</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Нажми “Активировать оффер” — получишь одноразовый код на 10 минут.
            </p>
          </div>

          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">3) Покажи код</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Персонал проверит код в staff-панели — и оффер применят к твоему заказу.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold text-gray-900">Правила (MVP)</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>Код действует 10 минут</li>
            <li>Одновременно можно иметь только 1 активный код</li>
            <li>В одном ресторане — не чаще 1 раза в 7 дней</li>
            <li>Офферы не суммируются с другими акциями (если не указано иначе)</li>
          </ul>
        </div>

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
            Оформить подписку
          </Link>
        </div>
      </section>
    </main>
  )
}