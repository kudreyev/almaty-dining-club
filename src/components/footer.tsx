import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">Dining Club Almaty</p>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Подписка с офферами 1+1 и комплиментами в ресторанах Алматы.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">Навигация</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600">
            <Link href="/">Главная</Link>
            <Link href="/almaty">Рестораны</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/staff/login">Staff Login</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">MVP</p>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>Алматы</p>
            <p>Офферы 1+1 и комплименты</p>
            <p>Kaspi на старте</p>
          </div>
        </div>
      </div>
    </footer>
  )
}