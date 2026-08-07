'use client'

import { useEffect, useState } from 'react'
import { PwaInstallBanner } from '@/components/pwa/pwa-install-banner'
import { incrementMeVisitCount } from '@/lib/pwa/install'

/**
 * Баннер PWA в кабинете активного подписчика — со 2-го визита /app/me.
 */
export function PwaCabinetInstallBanner() {
  const [visits, setVisits] = useState(0)

  useEffect(() => {
    setVisits(incrementMeVisitCount())
  }, [])

  if (visits < 2) return null

  return <PwaInstallBanner meVisitCount={visits} className="mb-6" />
}
