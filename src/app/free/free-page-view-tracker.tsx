'use client'

import { useEffect, useRef } from 'react'
import { trackGoal } from '@/lib/analytics-client'

type FreePageViewTrackerProps = {
  utmSource: string | null
  venueSlug: string | null
  promoCode: string | null
}

/** Один раз за сессию страницы: цель Метрики free_page_view. */
export function FreePageViewTracker({
  utmSource,
  venueSlug,
  promoCode,
}: FreePageViewTrackerProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackGoal('free_page_view', {
      ...(utmSource ? { utm_source: utmSource } : {}),
      ...(venueSlug ? { venue_slug: venueSlug } : {}),
      ...(promoCode ? { promo_code: promoCode } : {}),
    })
  }, [promoCode, utmSource, venueSlug])

  return null
}
