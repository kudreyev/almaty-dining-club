import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-semibold">KudaPass</p>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Подписка с офферами 1+1 и комплиментами в ресторанах Алматы.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">Навигация</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600">
            <Link href="/">Главная</Link>
            <Link href="/almaty">Рестораны</Link>
            <Link href="/pricing">Подписка</Link>
            <Link href="/staff/login">Вход для персонала</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">Правовая информация</p>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <Link href="/terms">Условия использования</Link>
            <Link href="/privacy">Политика конфиденциальности</Link>
            <Link href="/support">Поддержка</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}