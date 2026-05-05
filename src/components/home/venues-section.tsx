'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Map as MapIcon } from 'lucide-react'
import { FilterChipsBar } from '@/components/home/filter-chips-bar'
import { RestaurantCard } from '@/components/home/restaurant-card'
import { EmptyState } from '@/components/ui/empty-state'
import { haversineDistanceKm } from '@/lib/distance'
import { getMaxBenefit } from '@/lib/offers'
import { pluralizeRu } from '@/lib/ru-plural'
import {
  getStoredGeolocationPermissionState,
  persistUserLocation,
  requestUserPosition,
  useUserLocation,
  type GeoPermissionState,
} from '@/lib/user-location'
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
  const nearby = sp.get('nearby') === '1'

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

  return { openNow, nearby, offers, cuisines }
}

function serializeFilters(filters: FilterState, base: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base.toString())

  if (filters.openNow) sp.set('open', '1')
  else sp.delete('open')

  if (filters.nearby) sp.set('nearby', '1')
  else sp.delete('nearby')

  if (filters.offers.size > 0) sp.set('offers', Array.from(filters.offers).join(','))
  else sp.delete('offers')

  if (filters.cuisines.size > 0) sp.set('cuisine', Array.from(filters.cuisines).join(','))
  else sp.delete('cuisine')

  // Чистим устаревшие ключи на случай, если пришли по старым ссылкам.
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

  const userLocation = useUserLocation()
  const [geoPermission, setGeoPermission] = useState<GeoPermissionState>('unknown')

  useEffect(() => {
    let cancelled = false
    getStoredGeolocationPermissionState().then((state) => {
      if (!cancelled) setGeoPermission(state)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const proximityDisabled = geoPermission === 'denied' && !userLocation

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

  const handleToggleNearby = useCallback(async () => {
    if (filters.nearby) {
      updateFilters({ ...filters, nearby: false })
      return
    }

    if (userLocation) {
      updateFilters({ ...filters, nearby: true })
      return
    }

    const permission = await getStoredGeolocationPermissionState()
    setGeoPermission(permission)
    if (permission === 'denied') return

    const result = await requestUserPosition()
    if (result.ok) {
      persistUserLocation(result.lat, result.lng)
      setGeoPermission('granted')
      updateFilters({ ...filters, nearby: true })
      return
    }

    if (result.permissionDenied) {
      setGeoPermission('denied')
    }
  }, [filters, updateFilters, userLocation])

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

  const displayed = useMemo(() => {
    const list = enriched.filter(({ restaurant, distanceKm }) => {
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

      if (filters.nearby && userLocation) {
        if (distanceKm === null) return false
      }

      return true
    })

    if (filters.nearby && userLocation) {
      list.sort((a, b) => {
        const da = a.distanceKm ?? Infinity
        const db = b.distanceKm ?? Infinity
        if (da !== db) return da - db
        return a.restaurant.restaurant_name.localeCompare(b.restaurant.restaurant_name, 'ru')
      })
    } else {
      list.sort((a, b) => {
        const oa = a.restaurant.openStatus.isOpen ? 0 : 1
        const ob = b.restaurant.openStatus.isOpen ? 0 : 1
        if (oa !== ob) return oa - ob
        if (b.maxBenefit !== a.maxBenefit) return b.maxBenefit - a.maxBenefit
        return a.restaurant.restaurant_name.localeCompare(b.restaurant.restaurant_name, 'ru')
      })
    }

    return list
  }, [enriched, filters, userLocation])

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

  return (
    <section className="mt-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {showCount ? (
            <span className="hidden text-xs text-neutral-500 sm:inline">{countLabel}</span>
          ) : null}
          <Link
            href={mapHref}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-sm text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            style={{ borderColor: 'var(--color-neutral-200, #e5e5e5)', borderWidth: '0.5px' }}
          >
            <MapIcon size={12} aria-hidden="true" />
            Карта
          </Link>
        </div>
      </div>

      <FilterChipsBar
        openNow={filters.openNow}
        nearby={filters.nearby && userLocation !== null}
        offers={filters.offers}
        cuisines={filters.cuisines}
        cuisineOptions={cuisineOptions}
        onToggleOpenNow={handleToggleOpenNow}
        onToggleNearby={handleToggleNearby}
        onToggleOffer={handleToggleOffer}
        onToggleCuisine={handleToggleCuisine}
        proximityDisabled={proximityDisabled}
      />

      {showCount ? (
        <p className="-mt-3 mb-3 text-xs text-neutral-500 sm:hidden">{countLabel}</p>
      ) : null}

      {displayed.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Попробуйте изменить фильтры" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayed.map(({ restaurant, distanceKm }) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              distanceKm={userLocation && distanceKm !== null ? distanceKm : null}
            />
          ))}
        </div>
      )}
    </section>
  )
}
