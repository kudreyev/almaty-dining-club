'use client'

import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import {
  META_SUBSCRIPTION_PRICE_KZT,
  trackMetaPixelInitiateCheckout,
} from '@/lib/meta-pixel-client'
import { buildInitiateCheckoutEventId } from '@/lib/meta-purchase'
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
  target = '_blank',
  rel = 'noopener noreferrer',
  ...rest
}: WhatsappGoalLinkProps) {
  return (
    <a
      {...rest}
      href={href ?? buildKudaclubSubscribeWhatsAppUrl(messageKind, restaurantName)}
      target={target}
      rel={rel}
      onClick={(e) => {
        const eventTime = Math.floor(Date.now() / 1000)
        const eventId = buildInitiateCheckoutEventId(source, eventTime)
        trackMetaPixelInitiateCheckout(
          {
            value: META_SUBSCRIPTION_PRICE_KZT,
            currency: 'KZT',
          },
          eventId,
        )
        trackGoal('whatsapp_click', { source })
        if (extraGoal) {
          trackGoal(extraGoal, { source })
        }
        onClick?.(e)
      }}
    />
  )
}
