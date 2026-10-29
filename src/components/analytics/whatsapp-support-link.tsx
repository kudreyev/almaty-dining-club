'use client'

import type { ComponentProps } from 'react'
import { trackGoal } from '@/lib/analytics-client'

type WhatsappSupportLinkProps = Omit<ComponentProps<'a'>, 'onClick'> & {
  /** Идёт в trackGoal('whatsapp_click', { source }). */
  source: string
  onClick?: ComponentProps<'a'>['onClick']
}

/** Саппортная wa.me-ссылка: трекает только goal в Метрике. */
export function WhatsappSupportLink({
  source,
  onClick,
  ...rest
}: WhatsappSupportLinkProps) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        trackGoal('whatsapp_click', { source })
        onClick?.(e)
      }}
    />
  )
}
