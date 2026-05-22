'use client'

import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'
import {
  buildKudaclubSubscribeWhatsAppUrl,
  type WhatsAppMessageKind,
} from '@/lib/whatsapp'

type WhatsappGoalLinkProps = Omit<ComponentProps<'a'>, 'href' | 'onClick'> & {
  /** Идёт в trackGoal('whatsapp_click', { source }) — может включать slug. */
  source: string
  href?: string
  onClick?: ComponentProps<'a'>['onClick']
  extraGoal?: string
  /** Базовый kind для выбора текста сообщения. Если не указан — дефолтный текст. */
  messageKind?: WhatsAppMessageKind
  /** Для kind 'venue-cta' / 'offer-card' — подставляется в текст сообщения. */
  restaurantName?: string
}

export function WhatsappGoalLink({
  source,
  href,
  onClick,
  extraGoal,
  messageKind,
  restaurantName,
  ...rest
}: WhatsappGoalLinkProps) {
  return (
    <a
      {...rest}
      href={href ?? buildKudaclubSubscribeWhatsAppUrl(messageKind, restaurantName)}
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
