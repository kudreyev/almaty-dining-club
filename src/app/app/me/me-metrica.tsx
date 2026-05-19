'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackGoal } from '@/lib/analytics-client'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'

export function MeMetrica() {
  const searchParams = useSearchParams()
  const firedActivated = useRef(false)

  useEffect(() => {
    if (searchParams.get('activated') !== 'true' || firedActivated.current) return
    firedActivated.current = true
    trackGoal('subscription_activated', {
      amount: 1990,
    })
    trackMetaPixel('Purchase', {
      value: META_SUBSCRIPTION_PRICE_KZT,
      currency: 'KZT',
    })
  }, [searchParams])

  return null
}
