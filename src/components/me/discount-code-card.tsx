'use client'

import { useEffect, useState } from 'react'
import {
  readCachedDiscountCode,
  saveCachedDiscountCode,
  type CachedDiscountCode,
} from '@/lib/pwa/discount-code-cache'

export type DiscountCodeProps = {
  tokenCode: string | null
  status: string | null
  expiresAt: string | null
  restaurantName: string | null
  offerTitle: string | null
}

function isUsable(code: {
  tokenCode: string | null | undefined
  status: string | null | undefined
  expiresAt: string | null | undefined
}): boolean {
  if (!code.tokenCode) return false
  if (code.status !== 'active') return false
  if (!code.expiresAt) return false
  return Date.parse(code.expiresAt) > Date.now()
}

export function DiscountCodeCard(props: DiscountCodeProps) {
  const [display, setDisplay] = useState<CachedDiscountCode | null>(() => {
    if (
      isUsable({
        tokenCode: props.tokenCode,
        status: props.status,
        expiresAt: props.expiresAt,
      })
    ) {
      return {
        tokenCode: props.tokenCode!,
        status: props.status ?? 'active',
        expiresAt: props.expiresAt,
        restaurantName: props.restaurantName,
        offerTitle: props.offerTitle,
        savedAt: new Date().toISOString(),
      }
    }
    return null
  })

  useEffect(() => {
    if (
      isUsable({
        tokenCode: props.tokenCode,
        status: props.status,
        expiresAt: props.expiresAt,
      })
    ) {
      const next: CachedDiscountCode = {
        tokenCode: props.tokenCode!,
        status: props.status ?? 'active',
        expiresAt: props.expiresAt,
        restaurantName: props.restaurantName,
        offerTitle: props.offerTitle,
        savedAt: new Date().toISOString(),
      }
      saveCachedDiscountCode(next)
      setDisplay(next)
      return
    }

    // Офлайн: только если кэш ещё active и не истёк.
    const cached = readCachedDiscountCode()
    if (
      cached &&
      isUsable({
        tokenCode: cached.tokenCode,
        status: cached.status,
        expiresAt: cached.expiresAt,
      })
    ) {
      setDisplay(cached)
      return
    }

    setDisplay(null)
  }, [props])

  if (!display || !isUsable(display)) return null

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white px-5 py-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-neutral-400">
        Код скидки
      </p>
      <p className="mt-3 text-4xl font-semibold tracking-[0.22em] tabular-nums text-neutral-900 sm:text-5xl">
        {display.tokenCode}
      </p>
      {display.restaurantName || display.offerTitle ? (
        <p className="mt-2 text-[13px] leading-[1.4] text-neutral-500">
          {[display.restaurantName, display.offerTitle].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <p className="mt-2 text-[12px] text-neutral-400">
        Покажите код сотруднику заведения
      </p>
    </section>
  )
}
