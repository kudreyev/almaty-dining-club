'use client'

import type { ReactNode } from 'react'
import SubscribeCTA from '@/components/checkout/subscribe-cta'
import { trackGoal } from '@/lib/analytics-client'
import {
  META_SUBSCRIPTION_PRICE_KZT,
  trackMetaPixelInitiateCheckout,
} from '@/lib/meta-pixel-client'
import { buildInitiateCheckoutEventId } from '@/lib/meta-purchase'

const SOURCE = 'home-trial-upgrade'

type TrialUpgradeLinkProps = {
  children: ReactNode
  className?: string
}

// Апгрейд триал-подписки в полную. Триал считается «active», поэтому
// forceCheckout=true — иначе SubscribeCTA показал бы «Подписка активна».
export function TrialUpgradeLink({ children, className }: TrialUpgradeLinkProps) {
  return (
    <SubscribeCTA
      source={SOURCE}
      className={className}
      forceCheckout
      onClick={() => {
        const eventTime = Math.floor(Date.now() / 1000)
        const eventId = buildInitiateCheckoutEventId(SOURCE, eventTime)
        trackMetaPixelInitiateCheckout(
          { value: META_SUBSCRIPTION_PRICE_KZT, currency: 'KZT' },
          eventId,
        )
        trackGoal('trial_to_paid_click', { source: SOURCE })
      }}
    >
      {children}
    </SubscribeCTA>
  )
}
