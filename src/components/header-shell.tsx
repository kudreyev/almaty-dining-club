'use client'

import { usePathname } from 'next/navigation'

type HeaderShellProps = {
  children: React.ReactNode
}

export function HeaderShell({ children }: HeaderShellProps) {
  const pathname = usePathname()
  const isFocusPage = pathname?.startsWith('/r/') ?? false

  if (isFocusPage) return null
  return <>{children}</>
}
