export const runtime = 'edge'

const WHATSAPP_SUBSCRIBE_URL =
  'https://wa.me/77066059899?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BF%D0%B8%D1%81%D0%BA%D1%83%20KudaPass%20%D0%BD%D0%B0%20%D0%BE%D0%B4%D0%B8%D0%BD%20%D0%BC%D0%B5%D1%81%D1%8F%D1%86'

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold">Подписка для Алматы</h1>
          <p className="mt-3 text-gray-600">
            Открой доступ ко всем офферам партнёров: 1+1 и комплиментам в ресторанах города.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Как это работает</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">1) Подписка</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Оформи доступ к партнёрам в Алматы. После подтверждения оплаты подписка активируется.
              </p>
            </div>

            <div className="rounded-3xl bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">2) Активируй оффер</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Нажми «Активировать оффер» — получишь одноразовый код на 10 минут.
              </p>
            </div>

            <div className="rounded-3xl bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">3) Покажи код</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Персонал проверит код в staff-панели — и оффер применят к твоему заказу.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm text-gray-500">План</p>
            <h2 className="mt-2 text-3xl font-semibold">Monthly Almaty</h2>
            <p className="mt-2 text-lg text-gray-700">4 990 ₸ / 30 дней</p>

            <ul className="mt-6 space-y-3 text-sm text-gray-700">
              <li>— Доступ ко всем активным офферам в Алматы</li>
              <li>— Форматы: 1+1 и комплименты</li>
              <li>— Использование через одноразовый код</li>
              <li>— Проверка оффера через staff panel</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              После активации подписки вы сможете открывать офферы и получать одноразовый код для
              использования в ресторане.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-900">Оформить подписку</p>
            <a
              href={WHATSAPP_SUBSCRIBE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
            >
              Оформить в WhatsApp
            </a>
            <p className="mt-3 text-sm text-gray-500">
              Откроется WhatsApp: ответим на все вопросы, выставим счёт и активируем подписку. Это займёт
              не более 5 минут.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
