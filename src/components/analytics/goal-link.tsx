'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'

type GoalLinkProps = ComponentProps<typeof Link> & {
  goal: 'login_cta_click' | 'partner_cta_click'
  source: string
}

/** Ссылка-CTA с целью в Метрике (и /api/track). */
export function GoalLink({ goal, source, onClick, ...rest }: GoalLinkProps) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        trackGoal(goal, { source })
        onClick?.(e)
      }}
    />
  )
}
