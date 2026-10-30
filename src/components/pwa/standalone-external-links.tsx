'use client'

import { useEffect } from 'react'
import { isStandaloneDisplay } from '@/lib/pwa/install'

/**
 * В установленном приложении ссылки на другие сайты (WhatsApp, Instagram, карты)
 * открываем снаружи, а не внутри окна PWA, где нет адресной строки и кнопки «назад».
 */
export function StandaloneExternalLinks() {
  useEffect(() => {
    if (!isStandaloneDisplay()) return
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return
      if (url.origin === window.location.origin) return
      event.preventDefault()
      window.open(url.href, '_blank', 'noopener,noreferrer')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
