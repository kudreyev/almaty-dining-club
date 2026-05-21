'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  parseSortModeFromSearchParams,
  serializeSortMode,
  type SortMode,
} from '@/lib/restaurant-filters'
import {
  getStoredGeolocationPermissionState,
  persistUserLocation,
  requestUserPosition,
  useUserLocation,
  type GeoPermissionState,
} from '@/lib/user-location'

const GEO_BANNER_DISMISS_KEY = 'kudaclub:geo_banner_dismissed'

export type HomeSortState = {
  /** Активный режим (после применения дефолтов и URL). */
  sortMode: SortMode
  /** Заявленный режим из URL (?sort=...) или null если не задан. */
  urlSortMode: SortMode | null
  /** Состояние разрешения геолокации (Permissions API). */
  permission: GeoPermissionState
  /** Сохранённые координаты пользователя (если есть). */
  userLocation: { lat: number; lng: number } | null
  /** Нельзя выбрать distance: либо отказано в браузере, либо API недоступен. */
  distanceDisabled: boolean
  /** Нужно ли показать мягкую плашку «Включить геолокацию». */
  shouldShowGeoBanner: boolean
  /** Переключить режим. Для distance может потребоваться запрос координат. */
  setSortMode: (next: SortMode) => void
  /** Запрос разрешения + переход на distance при success. */
  requestDistanceMode: () => Promise<void>
  /** Закрыть плашку до конца сессии. */
  dismissGeoBanner: () => void
}

function isBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(GEO_BANNER_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function markBannerDismissed(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(GEO_BANNER_DISMISS_KEY, '1')
  } catch {
    // sessionStorage может быть недоступен — не критично
  }
}

export function useHomeSort(): HomeSortState {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlSortMode = useMemo<SortMode | null>(
    () => parseSortModeFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const userLocation = useUserLocation()

  const [permission, setPermission] = useState<GeoPermissionState>('unknown')
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    getStoredGeolocationPermissionState().then((state) => {
      if (cancelled) return
      setPermission(state)
      // Если разрешение уже выдано, но координат в localStorage ещё нет —
      // тихо подтягиваем (диалог не показываем, разрешение есть).
      if (state === 'granted' && !userLocation) {
        requestUserPosition().then((result) => {
          if (!result.ok) return
          persistUserLocation(result.lat, result.lng)
        })
      }
    })
    setBannerDismissed(isBannerDismissed())
    return () => {
      cancelled = true
    }
    // Эффект разовый — на следующих рендерах permission/location обновляем явно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const distanceDisabled =
    permission === 'denied' || (permission === 'unknown' && !userLocation)

  // Активный режим: URL переопределяет дефолт; дефолт — distance, если есть координаты, иначе benefit.
  const resolvedSortMode: SortMode = useMemo(() => {
    if (urlSortMode) {
      if (urlSortMode === 'distance' && !userLocation && distanceDisabled) {
        return 'benefit'
      }
      return urlSortMode
    }
    return userLocation ? 'distance' : 'benefit'
  }, [urlSortMode, userLocation, distanceDisabled])

  const writeSortModeToUrl = useCallback(
    (next: SortMode) => {
      const sp = new URLSearchParams(searchParams.toString())
      serializeSortMode(sp, next)
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const setSortMode = useCallback(
    (next: SortMode) => {
      writeSortModeToUrl(next)
    },
    [writeSortModeToUrl]
  )

  const requestDistanceMode = useCallback(async () => {
    if (userLocation) {
      writeSortModeToUrl('distance')
      return
    }

    const currentPermission = await getStoredGeolocationPermissionState()
    setPermission(currentPermission)
    if (currentPermission === 'denied') {
      return
    }

    const result = await requestUserPosition()
    if (result.ok) {
      persistUserLocation(result.lat, result.lng)
      setPermission('granted')
      writeSortModeToUrl('distance')
      return
    }

    if (result.permissionDenied) {
      setPermission('denied')
      markBannerDismissed()
      setBannerDismissed(true)
    }
  }, [userLocation, writeSortModeToUrl])

  const dismissGeoBanner = useCallback(() => {
    markBannerDismissed()
    setBannerDismissed(true)
  }, [])

  const shouldShowGeoBanner =
    !bannerDismissed &&
    !userLocation &&
    permission === 'prompt' &&
    resolvedSortMode === 'benefit'

  return {
    sortMode: resolvedSortMode,
    urlSortMode,
    permission,
    userLocation,
    distanceDisabled,
    shouldShowGeoBanner,
    setSortMode,
    requestDistanceMode,
    dismissGeoBanner,
  }
}
