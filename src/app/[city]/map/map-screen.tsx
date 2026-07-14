'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { YandexRestaurantsMap } from '@/components/map/yandex-restaurants-map'
import { FloatingMapSwitch } from '@/components/map/floating-map-switch'
import { RestaurantFiltersSheet } from '@/components/restaurant-filters-sheet'
import { useUrlRestaurantFilters } from '@/components/map/use-url-filters'
import {
  getStoredUserLocation,
  persistUserLocation,
  requestUserPosition,
} from '@/lib/user-location'
import type { OfferType } from '@/lib/offers'
import type { RestaurantFilters } from '@/lib/restaurant-filters'

type Place = {
  slug: string
  name: string
  lat: number | null
  lng: number | null
  offerChips: string[]
  offerTypes: OfferType[]
  cuisines: string[]
  isOpen: boolean
  statusLine: string
}

export function MapScreen({
  places,
  allCuisineOptions,
  listHref = '/',
}: {
  places: Place[]
  allCuisineOptions: string[]
  listHref?: string
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const { filters, setFilters, buildHrefWithSameFilters } = useUrlRestaurantFilters()

  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      if (filters.openNow && !p.isOpen) return false
      if (filters.offers.size > 0) {
        const matches = p.offerTypes.some((t) => filters.offers.has(t))
        if (!matches) return false
      }
      if (filters.cuisines.size > 0) {
        const matches = p.cuisines.some((c) => filters.cuisines.has(c))
        if (!matches) return false
      }
      return true
    })
  }, [places, filters])

  const handleFiltersChange = useCallback(
    async (next: RestaurantFilters) => {
      const turningOnNearby = next.nearby && !filters.nearby
      if (turningOnNearby && !getStoredUserLocation()) {
        const result = await requestUserPosition()
        if (result.ok) {
          persistUserLocation(result.lat, result.lng)
          setGeoHint(null)
        } else {
          if (result.permissionDenied) {
            setGeoHint('Геолокация отключена — поделитесь местоположением, чтобы фильтр работал.')
          }
          // Не включаем nearby, если локация недоступна.
          setFilters({ ...next, nearby: false })
          return
        }
      }
      setFilters(next)
    },
    [filters.nearby, setFilters]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const askedKey = 'kp:geoAskedAt'
    const askedAt = Number(localStorage.getItem(askedKey) ?? '0')
    const weekMs = 7 * 24 * 60 * 60 * 1000
    if (askedAt && Date.now() - askedAt < weekMs) return

    localStorage.setItem(askedKey, String(Date.now()))

    let cancelled = false
    requestUserPosition().then((result) => {
      if (cancelled) return
      if (result.ok) {
        persistUserLocation(result.lat, result.lng)
      } else if (result.permissionDenied) {
        setGeoHint('Геолокация отключена — показываем все заведения.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden sm:h-auto sm:min-h-[calc(100dvh-3.5rem)]">
      {/* CONTENT */}
      <div className="absolute inset-0">
        <div className="h-full w-full">
          <YandexRestaurantsMap places={filteredPlaces} />
        </div>
      </div>

      <FloatingMapSwitch
        leftLabel="Фильтр"
        onLeftClick={() => setSheetOpen(true)}
        rightLabel="Список"
        rightHref={buildHrefWithSameFilters(listHref)}
      />

      <RestaurantFiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={handleFiltersChange}
        cuisineOptions={allCuisineOptions}
        applyCount={filteredPlaces.length}
        geoHint={geoHint}
      />
    </div>
  )
}
