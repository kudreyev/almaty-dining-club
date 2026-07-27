'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WhatsappSupportLink } from '@/components/analytics/whatsapp-support-link'
import {
  formatLegalEntityFooterLines,
  hasLegalEntityDetails,
  LEGAL_ENTITY,
} from '@/lib/legal-entity'

export function Footer() {
  const pathname = usePathname()
  const hideOnMobile = pathname?.endsWith('/map') ?? false
  const isHidden = pathname?.startsWith('/r/') ?? false
  const year = new Date().getFullYear()
  const legalLines = formatLegalEntityFooterLines(LEGAL_ENTITY)
  const showLegalDetails = hasLegalEntityDetails(LEGAL_ENTITY)

  if (isHidden) return null

  return (
    <footer className={hideOnMobile ? 'hidden sm:block' : ''}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col-reverse gap-4 border-t border-neutral-200/60 py-6 md:flex-row md:items-end md:justify-between md:gap-6 md:py-8">
          <div className="space-y-2">
            {showLegalDetails ? (
              <div className="space-y-0.5 text-xs leading-relaxed text-neutral-500">
                {legalLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-neutral-500">© {year} Kudaclub</p>
          </div>

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

            <Link
              href="/offer"
              className="transition-colors hover:text-neutral-900"
            >
              Публичная оферта
            </Link>
            <span aria-hidden="true" className="text-neutral-300">·</span>

            <WhatsappSupportLink
              source="footer-support"
              href="https://wa.me/77066059899"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neutral-900"
            >
              Написать нам
            </WhatsappSupportLink>
          </nav>
        </div>
      </div>
    </footer>
  )
}
