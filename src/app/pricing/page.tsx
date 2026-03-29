const WHATSAPP_SUBSCRIBE_URL =
  'https://wa.me/77066059899?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BF%D0%B8%D1%81%D0%BA%D1%83%20KudaPass%20%D0%BD%D0%B0%20%D0%BE%D0%B4%D0%B8%D0%BD%20%D0%BC%D0%B5%D1%81%D1%8F%D1%86'

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
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
          Откроется WhatsApp: ответим на все вопросы, выставим счёт и активируем подписку. Это займёт не
          более 5 минут.
        </p>
      </div>
    </main>
  )
}
