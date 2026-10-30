'use client'

import { ChevronLeft } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useInstallState } from '@/components/pwa/install-state-provider'

const ROOT_PATHS = new Set(['/', '/almaty', '/astana'])

/** В установленном приложении нет кнопки «назад» браузера — показываем свою на внутренних страницах. */
export function StandaloneBackButton({ fallbackHref }: { fallbackHref: string }) {
  const { standalone } = useInstallState()
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  if (!standalone || ROOT_PATHS.has(pathname)) return null

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Назад"
      className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
    >
      <ChevronLeft size={22} strokeWidth={2} />
    </button>
  )
}
