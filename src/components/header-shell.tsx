'use client'

import { usePathname } from 'next/navigation'

type HeaderShellProps = {
  children: React.ReactNode
}

export function HeaderShell({ children }: HeaderShellProps) {
  const pathname = usePathname()
  const isFocusPage = pathname?.startsWith('/r/') ?? false

  if (isFocusPage) {
    // На странице заведения шапка остаётся в обычном потоке (не sticky),
    // чтобы поверх скроллилась только локальная sticky-навигация страницы.
    return (
      <div className="[&>header]:static! [&>header]:top-auto! [&>header]:z-auto!">
        {children}
      </div>
    )
  }

  return <>{children}</>
}
