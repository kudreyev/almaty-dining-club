'use client'

import type { ComponentProps, ReactNode } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'
import { buildKudaclubSubscribeWhatsAppUrl } from '@/lib/whatsapp'

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
        trackMetaPixel('InitiateCheckout', {
          value: META_SUBSCRIPTION_PRICE_KZT,
          currency: 'KZT',
        })
        trackGoal('whatsapp_click', { source: 'home-trial-upgrade' })
        trackGoal('trial_to_paid_click', { source: 'home-trial-upgrade' })
      }}
    >
      {children}
    </a>
  )
}
