'use client'

import { useEffect, useRef } from 'react'
import { trackMetaPixel } from '@/lib/meta-pixel-client'

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
    })
  }, [restaurantName, restaurantSlug])

  return null
}
