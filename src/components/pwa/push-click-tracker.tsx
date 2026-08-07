'use client'

/**
 * Надёжный учёт push_clicked:
 * 1) query ?push_click=1 при openWindow из SW (холодный старт)
 * 2) postMessage от SW при focus существующего окна
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { trackGoal } from '@/lib/analytics-client'

export function PushClickTracker() {
  const pathname = usePathname()
  const router = useRouter()
  const handledUrlRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('push_click') !== '1') return

      const key = url.pathname + url.search
      if (handledUrlRef.current === key) return
      handledUrlRef.current = key

      trackGoal('push_clicked')
      url.searchParams.delete('push_click')
      const next =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
        url.hash
      window.history.replaceState({}, '', next)
    } catch {
      // ignore
    }
  }, [pathname])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; url?: string }
        | null
        | undefined
      if (!data || data.type !== 'PUSH_CLICK') return

      trackGoal('push_clicked')

      if (typeof data.url === 'string' && data.url) {
        try {
          const target = new URL(data.url, window.location.origin)
          target.searchParams.delete('push_click')
          const path = target.pathname + target.search + target.hash
          const current =
            window.location.pathname + window.location.search + window.location.hash
          if (path !== current) {
            router.push(path)
          }
        } catch {
          // ignore bad url
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [router])

  return null
}
