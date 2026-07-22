'use client'

// src/components/checkout/subscribe-cta.tsx
// Единая кнопка покупки подписки. Заменяет все ссылки на wa.me в роли CTA.
// Гость → чекаут с шага телефона; залогинен без подписки → сразу оплата;
// активный подписчик → ссылка в личный кабинет.

import { useState } from 'react'
import Link from 'next/link'
import CheckoutModal from '@/components/checkout/checkout-modal'
import { useUser } from '@/lib/auth/use-user'
import { trackGoal } from '@/lib/analytics-client'

type Props = {
  /** Источник для аналитики: header | pricing | venue-<slug> | map | home-hero … */
  source: string
  className?: string
  children?: React.ReactNode
  /** Класс для варианта «Подписка активна ✓» (по умолчанию — как у основной кнопки). */
  activeClassName?: string
  /** Доп. обработчик клика (например, закрыть меню). Вызывается до открытия модалки. */
  onClick?: () => void
  /**
   * Всегда открывать чекаут, даже если подписка активна.
   * Нужно для апгрейда триала в полную подписку (триал тоже «active»).
   */
  forceCheckout?: boolean
}

export default function SubscribeCTA({
  source,
  className,
  children,
  activeClassName,
  onClick,
  forceCheckout = false,
}: Props) {
  const { user } = useUser()
  const [open, setOpen] = useState(false)

  if (!forceCheckout && user?.subscriptionStatus === 'active') {
    return (
      <Link href="/app/me" className={activeClassName ?? className} onClick={onClick}>
        Подписка активна ✓
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onClick?.()
          trackGoal('cta_click', { source })
          setOpen(true)
        }}
      >
        {children ?? 'Попробовать за 1 990 ₸'}
      </button>
      {open ? (
        <CheckoutModal
          user={user ? { id: user.id, phone: user.phone } : null}
          source={source}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
