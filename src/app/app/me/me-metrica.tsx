'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackGoal } from '@/lib/analytics-client'
import {
  META_SUBSCRIPTION_PRICE_KZT,
  trackMetaPixelPurchase,
} from '@/lib/meta-pixel-client'

export function MeMetrica() {
  const searchParams = useSearchParams()
  const firedActivated = useRef(false)

  useEffect(() => {
    if (searchParams.get('activated') !== 'true' || firedActivated.current) return
    firedActivated.current = true

    const purchaseEventId = searchParams.get('purchase_event_id')

    trackGoal('subscription_activated', {
      amount: META_SUBSCRIPTION_PRICE_KZT,
    })

    if (purchaseEventId) {
      trackMetaPixelPurchase(
        {
          value: META_SUBSCRIPTION_PRICE_KZT,
          currency: 'KZT',
        },
        purchaseEventId,
      )
    }
  }, [searchParams])

  return null
}
