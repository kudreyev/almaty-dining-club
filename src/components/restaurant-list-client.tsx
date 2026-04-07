'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatOfferHeadline } from '@/lib/offers'
import { haversineDistanceKm } from '@/lib/distance'

type Offer = {
  offer_type: '2for1' | 'compliment'
  offer_title: string
  is_active: boolean
}

type RestaurantLocation = {
  lat: number | null
  lng: number | null
  is_active: boolean
  sort_order: number
}

type RestaurantWithStatus = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string
  cover_photo_url?: string | null
  offers: Offer[]
  openStatus: {
    isOpen: boolean
    labelDetail: string | null
  }
  restaurant_locations?: RestaurantLocation[]
}

type QuickChip = {
  label: string
  href: string
  isActive: boolean
}

type Props = {
  restaurants: RestaurantWithStatus[]
  quickChips: QuickChip[]
  /** Заголовок блока (по умолчанию «Заведения») */
  title?: string
  /** Показывать ссылку «Карта» в шапке блока */
  showMapLink?: boolean
}

function requestUserPosition(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    )
  })
}

export function RestaurantListClient({
  restaurants,
  quickChips,
  title = 'Заведения',
  showMapLink = true,
}: Props) {
  const [proximityOn, setProximityOn] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoMessage, setGeoMessage] = useState<string | null>(null)

  const fetchLocation = useCallback(async (): Promise<boolean> => {
    const pos = await requestUserPosition()
    if (pos) {
      setUserLocation(pos)
      setGeoMessage(null)
      return true
    }
    setGeoMessage('Геолокация недоступна — сортируем по алфавиту.')
    return false
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const ok = await fetchLocation()
      if (cancelled) return
      if (ok) setProximityOn(true)
    })()

    return () => {
      cancelled = true
    }
  }, [fetchLocation])

  const sortedRestaurants = useMemo(() => {
    const useProximity = proximityOn && userLocation !== null

    const enriched = restaurants.map((restaurant) => {
      const primaryLocation = (restaurant.restaurant_locations ?? [])
        .filter((location) => location.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]

      const hasCoords = primaryLocation?.lat != null && primaryLocation?.lng != null
      const distanceKm =
        useProximity && hasCoords
          ? haversineDistanceKm(
              userLocation.lat,
              userLocation.lng,
              primaryLocation.lat as number,
              primaryLocation.lng as number
            )
          : Number.POSITIVE_INFINITY

      return { restaurant, distanceKm }
    })

    if (useProximity) {
      return enriched.sort((a, b) => a.distanceKm - b.distanceKm)
    }

    return enriched.sort((a, b) =>
      a.restaurant.restaurant_name.localeCompare(b.restaurant.restaurant_name, 'ru')
    )
  }, [restaurants, proximityOn, userLocation])

  const proximityChipActive = proximityOn && userLocation !== null

  const onProximityChipClick = async () => {
    if (proximityOn) {
      setProximityOn(false)
      setGeoMessage(null)
      return
    }

    if (userLocation) {
      setProximityOn(true)
      setGeoMessage(null)
      return
    }

    const ok = await fetchLocation()
    if (ok) {
      setProximityOn(true)
    }
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">{title}</h2>
          <div className="flex items-center gap-3">
            {showMapLink ? (
              <Link
                href="/map"
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
              >
                Карта
              </Link>
            ) : null}
            <p className="shrink-0 text-base text-gray-400">{sortedRestaurants.length} шт.</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onProximityChipClick}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              proximityChipActive
                ? 'border-gray-900 bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            По близости
          </button>
          {quickChips.map((chip) => (
            <Link
              key={`${chip.label}-${chip.href}`}
              href={chip.href}
              scroll={false}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                chip.isActive
                  ? 'border-gray-900 bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </div>

        {geoMessage ? (
          <p className="mt-2 text-xs text-gray-500">{geoMessage}</p>
        ) : null}

      </div>

      {sortedRestaurants.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Попробуйте изменить фильтры" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRestaurants.map(({ restaurant: r, distanceKm }) => (
            <Link
              key={r.id}
              href={`/r/${r.slug}`}
              className="group block overflow-hidden rounded-2xl border border-gray-300/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_-2px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.05),0_12px_28px_-6px_rgba(0,0,0,0.12)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                {r.cover_photo_url ? (
                  <Image
                    src={r.cover_photo_url}
                    alt={r.restaurant_name}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, 400px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-base text-gray-300">
                    Нет фото
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-lg font-bold tracking-tight leading-tight text-gray-950 sm:text-xl">{r.restaurant_name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[r.cuisine, r.cuisine_2, r.cuisine_3]
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((c) => (
                      <Badge key={c as string}>{c as string}</Badge>
                    ))}
                </div>

                <p className={`mt-2 text-sm ${r.openStatus.isOpen ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {r.openStatus.isOpen
                    ? (r.openStatus.labelDetail
                        ? `Открыто · ${r.openStatus.labelDetail.replace('Работает до ', 'до ')}`
                        : 'Открыто')
                    : (r.openStatus.labelDetail
                        ? `Закрыто · ${r.openStatus.labelDetail.charAt(0).toLowerCase()}${r.openStatus.labelDetail.slice(1)}`
                        : 'Закрыто')}
                </p>

                {proximityChipActive && Number.isFinite(distanceKm) ? (
                  <p className="mt-1 text-sm text-gray-500">{distanceKm.toFixed(1)} км</p>
                ) : null}

                {r.offers.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {r.offers.slice(0, 3).map((o, i) => (
                      <span
                        key={`${r.id}-offer-${i}`}
                        className="inline-flex max-w-full shrink-0 items-center rounded-full bg-black px-3 py-1 text-sm font-medium text-white"
                      >
                        <span className="truncate">{formatOfferHeadline(o.offer_type, o.offer_title)}</span>
                      </span>
                    ))}
                    {r.offers.length > 3 ? (
                      <span className="text-sm text-gray-400">и ещё {r.offers.length - 3}</span>
                    ) : null}
                  </div>
                ) : null}

                {r.address ? (
                  <p className="mt-3 truncate text-base leading-6 text-gray-500">{r.address}</p>
                ) : (
                  <p className="mt-3 text-base leading-6 text-gray-500 line-clamp-2">
                    {r.short_description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
