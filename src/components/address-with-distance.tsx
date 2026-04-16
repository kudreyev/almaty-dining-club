'use client'

import { useEffect, useState } from 'react'
import { haversineDistanceKm, formatDistance } from '@/lib/distance'

type AddressWithDistanceProps = {
  address: string | null | undefined
  restaurantLat: number | null
  restaurantLng: number | null
}

export function AddressWithDistance({ address, restaurantLat, restaurantLng }: AddressWithDistanceProps) {
  const [distanceLabel, setDistanceLabel] = useState<string | null>(null)

  useEffect(() => {
    if (restaurantLat == null || restaurantLng == null) return
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return

    let cancelled = false

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return
            const km = haversineDistanceKm(
              pos.coords.latitude,
              pos.coords.longitude,
              restaurantLat,
              restaurantLng
            )
            setDistanceLabel(formatDistance(km))
          },
          () => {},
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        )
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [restaurantLat, restaurantLng])

  if (!address) return null

  return (
    <p className="mt-3 text-sm leading-6 text-gray-500">
      {address}
      {distanceLabel ? (
        <span className="text-gray-400"> · {distanceLabel}</span>
      ) : null}
    </p>
  )
}
