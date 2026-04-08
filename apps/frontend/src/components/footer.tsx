import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-gray-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-bold tracking-tight">KudaPass</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Подписка с офферами 2за1 и в подарок в ресторанах Алматы.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Навигация</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/" className="text-sm text-gray-600 transition-colors hover:text-black">Заведения</Link>
              <Link href="/pricing" className="text-sm text-gray-600 transition-colors hover:text-black">Подписка</Link>
              <Link href="/staff/login" className="text-sm text-gray-600 transition-colors hover:text-black">Вход для персонала</Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Информация</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/terms" className="text-sm text-gray-600 transition-colors hover:text-black">Условия использования</Link>
              <Link href="/privacy" className="text-sm text-gray-600 transition-colors hover:text-black">Конфиденциальность</Link>
              <a
                href="https://wa.me/77066059899"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 transition-colors hover:text-black"
              >
                Поддержка через WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} KudaPass
        </div>
      </div>
    </footer>
  )
}
