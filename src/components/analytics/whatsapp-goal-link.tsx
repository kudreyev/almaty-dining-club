'use client'

import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'
import { buildKudaclubSubscribeWhatsAppUrl } from '@/lib/whatsapp'

type WhatsappGoalLinkProps = Omit<ComponentProps<'a'>, 'href' | 'onClick'> & {
  source: string
  href?: string
  onClick?: ComponentProps<'a'>['onClick']
  extraGoal?: string
}

export function WhatsappGoalLink({
  source,
  href,
  onClick,
  extraGoal,
  ...rest
}: WhatsappGoalLinkProps) {
  return (
    <a
      {...rest}
      href={href ?? buildKudaclubSubscribeWhatsAppUrl()}
      onClick={(e) => {
        trackMetaPixel('InitiateCheckout', {
          value: META_SUBSCRIPTION_PRICE_KZT,
          currency: 'KZT',
        })
        trackGoal('whatsapp_click', { source })
        if (extraGoal) {
          trackGoal(extraGoal, { source })
        }
        onClick?.(e)
      }}
    />
  )
}
