'use client'

import { useEffect, useRef } from 'react'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'

type MetaPixelViewContentProps = {
  restaurantName: string
  restaurantSlug: string
}

export function MetaPixelViewContent({
  restaurantName,
  restaurantSlug,
}: MetaPixelViewContentProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackMetaPixel('ViewContent', {
      content_name: restaurantName,
      content_category: 'restaurant',
      content_ids: [restaurantSlug],
      value: META_SUBSCRIPTION_PRICE_KZT,
      currency: 'KZT',
    })
  }, [restaurantName, restaurantSlug])

  return null
}
