'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackGoal } from '@/lib/analytics-client'
import {
  META_SUBSCRIPTION_PRICE_KZT,
  trackMetaPixelPurchase,
  trackMetaPixelStartTrial,
} from '@/lib/meta-pixel-client'

export function MeMetrica() {
  const searchParams = useSearchParams()
  const firedActivated = useRef(false)

  useEffect(() => {
    if (searchParams.get('activated') !== 'true' || firedActivated.current) return
    firedActivated.current = true

    const activationKind = searchParams.get('activation_kind')
    const purchaseEventId = searchParams.get('purchase_event_id')
    const trialEventId = searchParams.get('trial_event_id')

    trackGoal('subscription_activated', {
      amount: activationKind === 'trial' ? 0 : META_SUBSCRIPTION_PRICE_KZT,
    })

    if (activationKind === 'paid' && purchaseEventId) {
      trackMetaPixelPurchase(
        {
          value: META_SUBSCRIPTION_PRICE_KZT,
          currency: 'KZT',
        },
        purchaseEventId,
      )
      return
    }

    if (activationKind === 'trial' && trialEventId) {
      trackMetaPixelStartTrial(
        {
          value: 0,
          currency: 'KZT',
        },
        trialEventId,
      )
    }
  }, [searchParams])

  return null
}
