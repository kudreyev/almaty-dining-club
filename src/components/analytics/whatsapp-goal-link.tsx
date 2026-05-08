'use client'

import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'

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
        trackGoal(goal, goalParams ?? {})
        onClick?.(e)
      }}
    />
  )
}
