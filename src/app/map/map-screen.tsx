'use client'

import { useEffect, useMemo, useState } from 'react'
import { YandexRestaurantsMap } from '@/components/map/yandex-restaurants-map'
import { FloatingMapSwitch } from '@/components/map/floating-map-switch'
import { RestaurantFiltersSheet } from '@/components/restaurant-filters-sheet'
import { useUrlRestaurantFilters } from '@/components/map/use-url-filters'
import type { RestaurantFilters } from '@/lib/restaurant-filters'

type Place = {
  slug: string
  name: string
  lat: number | null
  lng: number | null
  offerChips: string[]
  offerTypes: Array<'2for1' | 'compliment'>
  cuisines: string[]
  isOpen: boolean
  statusLine: string
}

export function MapScreen({
  places,
  allCuisineOptions,
}: {
  places: Place[]
  allCuisineOptions: string[]
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

  const coordsCount = useMemo(
    () => filteredPlaces.filter((p) => p.lat != null && p.lng != null).length,
    [filteredPlaces]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia?.('(max-width: 639px)').matches) return
    if (!navigator.geolocation) return

    const askedKey = 'kp:geoAskedAt'
    const locKey = 'kp:userLocation'
    const askedAt = Number(localStorage.getItem(askedKey) ?? '0')
    const weekMs = 7 * 24 * 60 * 60 * 1000
    if (askedAt && Date.now() - askedAt < weekMs) return

    localStorage.setItem(askedKey, String(Date.now()))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
        }
        localStorage.setItem(locKey, JSON.stringify(payload))
      },
      (err) => {
        if (err?.code === 1) {
          setGeoHint('Геолокация отключена — показываем все заведения.')
        }
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    )
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
        rightHref={buildHrefWithSameFilters('/')}
      />

      <RestaurantFiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={(next: RestaurantFilters) => setFilters(next)}
        cuisineOptions={allCuisineOptions}
        applyCount={filteredPlaces.length}
        geoHint={geoHint}
      />
    </div>
  )
}

