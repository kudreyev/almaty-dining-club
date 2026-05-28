'use client'

import type { ComponentProps, ReactNode } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import {
  META_SUBSCRIPTION_PRICE_KZT,
  trackMetaPixelInitiateCheckout,
} from '@/lib/meta-pixel-client'
import { buildInitiateCheckoutEventId } from '@/lib/meta-purchase'
import { buildKudaclubSubscribeWhatsAppUrl } from '@/lib/whatsapp'

const SOURCE = 'home-trial-upgrade'

type TrialUpgradeLinkProps = Omit<ComponentProps<'a'>, 'href' | 'onClick'> & {
  children: ReactNode
}

export function TrialUpgradeLink({ children, ...rest }: TrialUpgradeLinkProps) {
  return (
    <a
      {...rest}
      href={buildKudaclubSubscribeWhatsAppUrl('home-trial-upgrade')}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        const eventTime = Math.floor(Date.now() / 1000)
        const eventId = buildInitiateCheckoutEventId(SOURCE, eventTime)
        trackMetaPixelInitiateCheckout(
          {
            value: META_SUBSCRIPTION_PRICE_KZT,
            currency: 'KZT',
          },
          eventId,
        )
        trackGoal('whatsapp_click', { source: SOURCE })
        trackGoal('trial_to_paid_click', { source: SOURCE })
      }}
    >
      {children}
    </a>
  )
}
