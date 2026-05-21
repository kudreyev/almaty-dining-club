'use client'

import { useMemo, useState } from 'react'
import { FloatingMapSwitch } from '@/components/map/floating-map-switch'
import { RestaurantFiltersSheet } from '@/components/restaurant-filters-sheet'
import { useUrlRestaurantFilters } from '@/components/map/use-url-filters'
import { useHomeSort } from '@/components/home/use-home-sort'

export function HomeMobileControls({
  cuisineOptions,
  applyCount,
}: {
  cuisineOptions: string[]
  applyCount: number
}) {
  const [open, setOpen] = useState(false)
  const { filters, setFilters, buildHrefWithSameFilters } = useUrlRestaurantFilters()
  const {
    sortMode,
    distanceDisabled,
    setSortMode,
    requestDistanceMode,
  } = useHomeSort()

  const safeCuisineOptions = useMemo(() => cuisineOptions.filter(Boolean), [cuisineOptions])

  return (
    <div className="relative sm:hidden">
      <FloatingMapSwitch
        leftLabel="Фильтр"
        onLeftClick={() => setOpen(true)}
        rightLabel="Карта"
        rightHref={buildHrefWithSameFilters('/map')}
      />

      <RestaurantFiltersSheet
        open={open}
        onClose={() => setOpen(false)}
        filters={filters}
        onChange={setFilters}
        cuisineOptions={safeCuisineOptions}
        applyCount={applyCount}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        distanceDisabled={distanceDisabled}
        onRequestDistanceMode={() => {
          void requestDistanceMode()
        }}
      />
    </div>
  )
}
