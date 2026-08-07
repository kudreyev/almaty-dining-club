'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  catalogHref: string
}

function isExpired(expiresAt: string | null, status: string | null): boolean {
  if (status && status !== 'active') return true
  if (!expiresAt) return false
  return Date.parse(expiresAt) <= Date.now()
}

export function DiscountCodeCard(props: DiscountCodeProps) {
  const [display, setDisplay] = useState<CachedDiscountCode | null>(() => {
    if (props.tokenCode) {
      return {
        tokenCode: props.tokenCode,
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
    if (props.tokenCode) {
      const next: CachedDiscountCode = {
        tokenCode: props.tokenCode,
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

    // Офлайн / пустой SSR — поднимаем последний код из localStorage.
    const cached = readCachedDiscountCode()
    if (cached) setDisplay(cached)
  }, [props])

  if (!display?.tokenCode) {
    return (
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white px-5 py-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-neutral-400">
          Код скидки
        </p>
        <p className="mt-3 text-[15px] leading-[1.45] text-neutral-600">
          Откройте оффер в заведении — здесь появится ваш код.
        </p>
        <Link
          href={props.catalogHref}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          К заведениям
        </Link>
      </section>
    )
  }

  const expired = isExpired(display.expiresAt, display.status)

  return (
    <section className="mb-6 rounded-2xl border border-neutral-200 bg-white px-5 py-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-neutral-400">
        Код скидки
      </p>
      <p
        className={`mt-3 text-4xl font-semibold tracking-[0.22em] tabular-nums sm:text-5xl ${
          expired ? 'text-neutral-400 line-through' : 'text-neutral-900'
        }`}
      >
        {display.tokenCode}
      </p>
      {display.restaurantName || display.offerTitle ? (
        <p className="mt-2 text-[13px] leading-[1.4] text-neutral-500">
          {[display.restaurantName, display.offerTitle].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {expired ? (
        <p className="mt-2 text-[12px] text-neutral-400">
          Код истёк — сгенерируйте новый в карточке оффера
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-neutral-400">
          Покажите код сотруднику заведения
        </p>
      )}
    </section>
  )
}
