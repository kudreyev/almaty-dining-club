'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import MapEntryCard from '@/components/MapEntryCard'
import { FilterChipsBar } from '@/components/home/filter-chips-bar'
import { RestaurantCard } from '@/components/home/restaurant-card'
import { EmptyState } from '@/components/ui/empty-state'
import { AnimatedGrid } from '@/components/home/animated-grid'
import { GeoSuggestionBanner } from '@/components/home/geo-suggestion-banner'
import { useHomeSort } from '@/components/home/use-home-sort'
import { haversineDistanceKm } from '@/lib/distance'
import { getMaxBenefit } from '@/lib/offers'
import { pluralizeRu } from '@/lib/ru-plural'
import { getBrandKey } from '@/lib/brand'
import { sortCatalog, type SortableItem } from '@/lib/catalog-sort'
import {
  hasAnyActiveFilter,
  type FilterState,
  type OfferType,
  type RestaurantWithStatus,
} from '@/lib/types'

type Props = {
  restaurants: RestaurantWithStatus[]
  cuisineOptions: string[]
  title?: string
}

function parseFilters(sp: URLSearchParams): FilterState {
  const openNow = sp.get('open') === '1'

  const offers = new Set<OfferType>()
  for (const x of (sp.get('offers') ?? '').split(',')) {
    const trimmed = x.trim()
    if (trimmed === '2for1' || trimmed === 'compliment') offers.add(trimmed)
  }

  const cuisines = new Set<string>(
    (sp.get('cuisine') ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  )

  return { openNow, nearby: false, offers, cuisines }
}

function serializeFilters(filters: FilterState, base: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base.toString())

  if (filters.openNow) sp.set('open', '1')
  else sp.delete('open')

  if (filters.offers.size > 0) sp.set('offers', Array.from(filters.offers).join(','))
  else sp.delete('offers')

  if (filters.cuisines.size > 0) sp.set('cuisine', Array.from(filters.cuisines).join(','))
  else sp.delete('cuisine')

  // На главной игнорируем устаревший nearby; режим сортировки управляется ?sort.
  sp.delete('nearby')
  sp.delete('openNow')
  sp.delete('offer')
  sp.delete('type')
  sp.delete('cuisines')

  return sp
}

function getRestaurantPrimaryCoords(restaurant: RestaurantWithStatus): { lat: number; lng: number } | null {
  const primary = (restaurant.restaurant_locations ?? [])
    .filter((location) => location.is_active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
  if (!primary || primary.lat == null || primary.lng == null) return null
  return { lat: primary.lat, lng: primary.lng }
}

export function VenuesSection({
  restaurants,
  cuisineOptions,
  title = 'Заведения',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const {
    sortMode,
    distanceDisabled,
    userLocation,
    shouldShowGeoBanner,
    setSortMode,
    requestDistanceMode,
    dismissGeoBanner,
  } = useHomeSort()

  const updateFilters = useCallback(
    (next: FilterState) => {
      const nextSp = serializeFilters(next, new URLSearchParams(searchParams.toString()))
      const qs = nextSp.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      router.replace(url, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleToggleOpenNow = useCallback(() => {
    updateFilters({ ...filters, openNow: !filters.openNow })
  }, [filters, updateFilters])

  const handleToggleOffer = useCallback(
    (offer: OfferType) => {
      const next = new Set(filters.offers)
      if (next.has(offer)) next.delete(offer)
      else next.add(offer)
      updateFilters({ ...filters, offers: next })
    },
    [filters, updateFilters]
  )

  const handleToggleCuisine = useCallback(
    (cuisine: string) => {
      const next = new Set(filters.cuisines)
      if (next.has(cuisine)) next.delete(cuisine)
      else next.add(cuisine)
      updateFilters({ ...filters, cuisines: next })
    },
    [filters, updateFilters]
  )

  const enriched = useMemo(() => {
    return restaurants.map((restaurant) => {
      const coords = getRestaurantPrimaryCoords(restaurant)
      const distanceKm =
        userLocation && coords
          ? haversineDistanceKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
          : null
      const maxBenefit = getMaxBenefit(restaurant.offers) ?? 0
      return { restaurant, distanceKm, maxBenefit }
    })
  }, [restaurants, userLocation])

  const filtered = useMemo(() => {
    return enriched.filter(({ restaurant }) => {
      if (filters.openNow && !restaurant.openStatus.isOpen) return false

      if (filters.offers.size > 0) {
        const hit = restaurant.offers.some(
          (offer) => offer.is_active && filters.offers.has(offer.offer_type)
        )
        if (!hit) return false
      }

      if (filters.cuisines.size > 0) {
        const cuisines = [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3].filter(
          Boolean
        ) as string[]
        const hit = cuisines.some((c) => filters.cuisines.has(c))
        if (!hit) return false
      }

      return true
    })
  }, [enriched, filters])

  const displayed = useMemo(() => {
    const sortable: (SortableItem & { restaurant: RestaurantWithStatus; distanceKm: number | null })[] =
      filtered.map(({ restaurant, distanceKm, maxBenefit }) => ({
        id: restaurant.id,
        isOpen: restaurant.openStatus.isOpen,
        distanceKm,
        maxBenefit,
        brandKey: getBrandKey({
          restaurant_name: restaurant.restaurant_name,
          brand: restaurant.brand ?? null,
        }),
        tiebreaker: restaurant.restaurant_name,
        restaurant,
      }))

    return sortCatalog(sortable, { mode: sortMode })
  }, [filtered, sortMode])

  const showCount = hasAnyActiveFilter(filters)
  const countLabel = `${displayed.length} ${pluralizeRu(displayed.length, [
    'заведение',
    'заведения',
    'заведений',
  ])}`

  const mapHref = useMemo(() => {
    const qs = new URLSearchParams(searchParams.toString()).toString()
    return qs ? `/map?${qs}` : '/map'
  }, [searchParams])

  const orderKey = useMemo(() => displayed.map((d) => d.id).join('|'), [displayed])

  return (
    <section className="mt-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {title}
        </h2>
        {showCount ? (
          <span className="hidden text-xs text-neutral-500 sm:inline">{countLabel}</span>
        ) : null}
      </div>

      <div className="mb-4">
        <MapEntryCard href={mapHref} />
      </div>

      <FilterChipsBar
        openNow={filters.openNow}
        offers={filters.offers}
        cuisines={filters.cuisines}
        cuisineOptions={cuisineOptions}
        onToggleOpenNow={handleToggleOpenNow}
        onToggleOffer={handleToggleOffer}
        onToggleCuisine={handleToggleCuisine}
        sortMode={sortMode}
        distanceDisabled={distanceDisabled}
        onSortModeChange={setSortMode}
        onRequestDistanceMode={() => {
          void requestDistanceMode()
        }}
      />

      {shouldShowGeoBanner ? (
        <GeoSuggestionBanner
          onEnable={() => {
            void requestDistanceMode()
          }}
          onDismiss={dismissGeoBanner}
        />
      ) : null}

      {showCount ? (
        <p className="-mt-3 mb-3 text-xs text-neutral-500 sm:hidden">{countLabel}</p>
      ) : null}

      {displayed.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Попробуйте изменить фильтры" />
      ) : (
        <AnimatedGrid
          orderKey={orderKey}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {displayed.map(({ restaurant, distanceKm }) => (
            <div key={restaurant.id} data-flip-id={restaurant.id}>
              <RestaurantCard
                restaurant={restaurant}
                distanceKm={userLocation && distanceKm !== null ? distanceKm : null}
              />
            </div>
          ))}
        </AnimatedGrid>
      )}
    </section>
  )
}
