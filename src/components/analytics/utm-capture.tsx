'use client'

/**
 * Один раз при заходе сохраняет utm_* / promo_code из URL в cookie kc_utm (30 дней).
 * Монтируется в корневом layout.
 */

import { useEffect } from 'react'
import {
  hasAnyUtm,
  parseUtmFromSearchParams,
  serializeUtmCookie,
  UTM_COOKIE_MAX_AGE_SEC,
  UTM_COOKIE_NAME,
} from '@/lib/utm'

export function UtmCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const fromUrl = parseUtmFromSearchParams(params)
      if (!hasAnyUtm(fromUrl)) return

      const value = encodeURIComponent(serializeUtmCookie(fromUrl))
      const secure =
        window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${UTM_COOKIE_NAME}=${value}; Path=/; Max-Age=${UTM_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`
    } catch {
      // ignore
    }
  }, [])

  return null
}

/** Читает атрибуцию из cookie (для TipTop metadata). */
export function readUtmFromCookie(): {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  promo_code?: string
} {
  if (typeof document === 'undefined') return {}
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${UTM_COOKIE_NAME}=`))
  if (!match) return {}
  const raw = match.slice(UTM_COOKIE_NAME.length + 1)
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'promo_code'] as const) {
      const v = parsed[key]
      if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 128)
    }
    return out
  } catch {
    return {}
  }
}
