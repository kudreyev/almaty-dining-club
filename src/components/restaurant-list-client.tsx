'use client'

import { useEffect, useMemo, useState } from 'react'
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

type SortMode = 'proximity' | 'alphabet'
type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

type Props = {
  restaurants: RestaurantWithStatus[]
  quickChips: QuickChip[]
}

export function RestaurantListClient({ restaurants, quickChips }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('alphabet')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown')
  const [geoMessage, setGeoMessage] = useState<string | null>(null)

  const requestGeolocation = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMessage('Геолокация не поддерживается в этом браузере.')
      return false
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setGeoMessage(null)
          resolve(true)
        },
        () => {
          setGeoMessage('Не удалось получить геолокацию — сортируем по алфавиту.')
          setSortMode('alphabet')
          resolve(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
      )
    })
  }

  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      if (typeof navigator === 'undefined') return

      if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
        setPermissionState('unknown')
        return
      }

      try {
        const status = await navigator.permissions.query({ name: 'geolocation' })
        if (cancelled) return

        const nextState = status.state as PermissionState
        setPermissionState(nextState)

        if (nextState === 'granted') {
          setSortMode('proximity')
          await requestGeolocation()
        }

        status.onchange = () => {
          const changedState = status.state as PermissionState
          setPermissionState(changedState)
        }
      } catch {
        setPermissionState('unknown')
      }
    }

    void setup()

    return () => {
      cancelled = true
    }
  }, [])

  const sortedRestaurants = useMemo(() => {
    const enriched = restaurants.map((restaurant) => {
      const primaryLocation = (restaurant.restaurant_locations ?? [])
        .filter((location) => location.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]

      const hasCoords = primaryLocation?.lat != null && primaryLocation?.lng != null
      const distanceKm =
        sortMode === 'proximity' && userLocation && hasCoords
          ? haversineDistanceKm(
              userLocation.lat,
              userLocation.lng,
              primaryLocation.lat as number,
              primaryLocation.lng as number
            )
          : Number.POSITIVE_INFINITY

      return { restaurant, distanceKm }
    })

    if (sortMode === 'proximity' && userLocation) {
      return enriched.sort((a, b) => a.distanceKm - b.distanceKm)
    }

    return enriched.sort((a, b) =>
      a.restaurant.restaurant_name.localeCompare(b.restaurant.restaurant_name, 'ru')
    )
  }, [restaurants, sortMode, userLocation])

  const onSelectProximity = async () => {
    setSortMode('proximity')
    const ok = await requestGeolocation()
    if (!ok) {
      setSortMode('alphabet')
    }
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">Заведения</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/map"
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              Карта
            </Link>
            <p className="shrink-0 text-base text-gray-400">{sortedRestaurants.length} шт.</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectProximity}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              sortMode === 'proximity'
                ? 'border-gray-900 bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            По близости
          </button>
          <button
            type="button"
            onClick={() => setSortMode('alphabet')}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              sortMode === 'alphabet'
                ? 'border-gray-900 bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            По алфавиту
          </button>
          {sortMode === 'alphabet' && permissionState !== 'granted' ? (
            <button
              type="button"
              onClick={onSelectProximity}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Включить геолокацию
            </button>
          ) : null}
        </div>

        {geoMessage ? <p className="mt-2 text-sm text-gray-500">{geoMessage}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
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

                {sortMode === 'proximity' && Number.isFinite(distanceKm) ? (
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
