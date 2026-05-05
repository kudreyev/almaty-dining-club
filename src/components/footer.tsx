'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Footer() {
  const pathname = usePathname()
  const hideOnMobile = pathname === '/map'
  const isHidden = pathname?.startsWith('/r/') ?? false
  const year = new Date().getFullYear()

  if (isHidden) return null

  return (
    <footer className={hideOnMobile ? 'hidden sm:block' : ''}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col-reverse gap-3 border-t border-neutral-200/60 py-6 md:flex-row md:items-center md:justify-between md:gap-0 md:py-8">
          <p className="text-xs text-neutral-500">© {year} Kudaclub</p>

          <nav
            aria-label="Дополнительные ссылки"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500"
          >
            <Link
              href="/staff/login"
              className="transition-colors hover:text-neutral-900"
            >
              Вход для персонала
            </Link>
            <span aria-hidden="true" className="text-neutral-300">·</span>

            <Link
              href="/terms"
              className="transition-colors hover:text-neutral-900"
            >
              Условия
            </Link>
            <span aria-hidden="true" className="text-neutral-300">·</span>

            <Link
              href="/privacy"
              className="transition-colors hover:text-neutral-900"
            >
              Конфиденциальность
            </Link>
            <span aria-hidden="true" className="text-neutral-300">·</span>

            <a
              href="https://wa.me/77066059899"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neutral-900"
            >
              Написать нам
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
