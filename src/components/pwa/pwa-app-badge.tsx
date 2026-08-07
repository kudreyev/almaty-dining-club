'use client'

/**
 * Badging API: бейдж на иконке PWA, если появились новые заведения
 * с последнего визита кабинета. Сброс — на /app/me.
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  clearAppBadgeSafe,
  markVenuesSeen,
  readVenuesSeenAt,
  setAppBadgeSafe,
} from '@/lib/pwa/venue-badge'

export function PwaAppBadge() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    async function run() {
      // Открытие кабинета = «увидел» новинки.
      if (pathname === '/app/me' || pathname.startsWith('/app/me/')) {
        markVenuesSeen()
        await clearAppBadgeSafe()
        return
      }

      const since = readVenuesSeenAt()
      if (!since) {
        // Первый заход — запоминаем baseline без бейджа.
        markVenuesSeen()
        return
      }

      try {
        const res = await fetch(
          `/api/venues/new-count?since=${encodeURIComponent(since)}`,
          { cache: 'no-store' },
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { count?: number }
        const count = typeof data.count === 'number' ? data.count : 0
        if (!cancelled) await setAppBadgeSafe(count)
      } catch {
        // offline / unsupported
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
