'use client'

import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'

type WhatsappGoalLinkProps = Omit<ComponentProps<'a'>, 'onClick'> & {
  goal: string
  goalParams?: Record<string, unknown>
  onClick?: ComponentProps<'a'>['onClick']
}

export function WhatsappGoalLink({
  goal,
  goalParams,
  onClick,
  ...rest
}: WhatsappGoalLinkProps) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        trackMetaPixel('InitiateCheckout', {
          value: META_SUBSCRIPTION_PRICE_KZT,
          currency: 'KZT',
        })
        trackGoal(goal, goalParams ?? {})
        onClick?.(e)
      }}
    />
  )
}
