'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { safeLog } from '@/lib/safe-logger'

type MapPlace = {
  slug: string
  name: string
  address?: string
  lat: number | null
  lng: number | null
  offerChips: string[]
  extraOffersCount?: number
  statusLine: string
}

type YMapGeoObjects = {
  add: (item: unknown) => void
}

type YMapInstance = {
  geoObjects: YMapGeoObjects
  setBounds: (bounds: unknown, options?: unknown) => void
  setCenter?: (center: [number, number], zoom?: number, options?: unknown) => void
  setZoom?: (zoom: number, options?: unknown) => void
  getZoom?: () => number
  destroy: () => void
}

type YClustererInstance = {
  add: (items: unknown[]) => void
  getBounds?: () => unknown
}

type YMapsApi = {
  ready: (callback: () => void) => void
  Map: new (container: HTMLElement, state: unknown, options?: unknown) => YMapInstance
  Placemark: new (coords: [number, number], properties?: unknown, options?: unknown) => unknown
  Clusterer: new (options?: unknown) => YClustererInstance
}

declare global {
  interface Window {
    ymaps?: YMapsApi
  }
}

const SCRIPT_ID = 'yandex-maps-script'

// Важно: Яндекс.Карты (JS API 2.1) используют порядок координат [lat, lng].
const ALMATY_CENTER_LAT_LNG: [number, number] = [43.238949, 76.889709]
const DEFAULT_ZOOM = 12
const FIT_PADDING = 40
const MAX_ZOOM = 15

function warnIfSuspiciousCoords(lat: number, lng: number, context: string) {
  if (process.env.NODE_ENV === 'production') return

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    safeLog.warn(`[map] suspicious coords (world bounds) ${context}`, {
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
    })
    return
  }

  // Алматы: грубая проверка диапазона, чтобы отлавливать swap lat/lng.
  const looksLikeAlmaty = lat >= 41 && lat <= 46 && lng >= 72 && lng <= 82
  if (!looksLikeAlmaty) {
    safeLog.warn(`[map] coords out of Almaty range ${context}`, {
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
    })
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildBalloonHtml(place: MapPlace): string {
  const chips = place.offerChips
    .map((chip) => `<span style="display:inline-block;border-radius:9999px;background:#D85A30;color:#ffffff;padding:3px 10px;font-size:11px;font-weight:500;line-height:1.4;">${escapeHtml(chip)}</span>`)
    .join(' ')
  const extraOffersText = place.extraOffersCount && place.extraOffersCount > 0
    ? `<span style="font-size:11px;line-height:1.4;color:#737373;">ещё ${place.extraOffersCount}</span>`
    : ''
  const safeAddress = place.address ? escapeHtml(place.address) : ''

  return `
    <a
      href="/r/${encodeURIComponent(place.slug)}"
      style="display:block;min-width:220px;max-width:260px;padding:10px 12px;border-radius:10px;font-family:Inter,system-ui,-apple-system,sans-serif;text-decoration:none;color:inherit;cursor:pointer;transition:background-color .15s ease;"
      onmouseover="this.style.backgroundColor='#fafafa'"
      onmouseout="this.style.backgroundColor='transparent'"
      onmousedown="this.style.backgroundColor='#f5f5f5'"
      onmouseup="this.style.backgroundColor='#fafafa'"
    >
      <div style="font-size:15px;font-weight:500;color:#171717;letter-spacing:-0.2px;">${escapeHtml(place.name)}</div>
      ${chips || extraOffersText ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">${chips}${extraOffersText}</div>` : ''}
      <div style="margin-top:8px;font-size:12px;color:#525252;line-height:1.5;">${escapeHtml(place.statusLine)}</div>
      ${safeAddress ? `<div style="margin-top:4px;font-size:12px;color:#737373;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeAddress}</div>` : ''}
    </a>
  `
}

async function loadYandexMaps(apiKey: string): Promise<YMapsApi> {
  if (window.ymaps) return window.ymaps

  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Не удалось загрузить скрипт Яндекс.Карт.')), { once: true })
    })
    if (!window.ymaps) throw new Error('API Яндекс.Карт не инициализировано.')
    return window.ymaps
  }

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${encodeURIComponent(apiKey)}`
  script.async = true

  await new Promise<void>((resolve, reject) => {
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Не удалось загрузить скрипт Яндекс.Карт.')), { once: true })
    document.head.appendChild(script)
  })

  if (!window.ymaps) throw new Error('API Яндекс.Карт не инициализировано.')
  return window.ymaps
}

export function YandexRestaurantsMap({ places }: { places: MapPlace[] }) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  const safePlaces = useMemo(
    () =>
      places.filter(
        (place) =>
          place.lat != null &&
          place.lng != null &&
          Number.isFinite(place.lat) &&
          Number.isFinite(place.lng)
      ),
    [places]
  )

  useEffect(() => {
    if (!containerRef.current) return
    if (!apiKey) {
      setError('Не указан ключ Яндекс.Карт.')
      return
    }

    let map: YMapInstance | null = null
    let disposed = false

    loadYandexMaps(apiKey)
      .then((ymaps) => {
        if (disposed || !containerRef.current) return

        ymaps.ready(() => {
          if (disposed || !containerRef.current) return

          map = new ymaps.Map(
            containerRef.current,
            {
              // Важно: порядок [lat, lng]
              center: ALMATY_CENTER_LAT_LNG,
              zoom: DEFAULT_ZOOM,
              controls: ['zoomControl', 'geolocationControl'],
            },
            {
              suppressMapOpenBlock: true,
            }
          )

          if (safePlaces.length > 0) {
            const clusterer = new ymaps.Clusterer({
              preset: 'islands#darkOrangeClusterIcons',
              groupByCoordinates: false,
            })

            const placemarks = safePlaces.map(
              (place) => {
                const lat = place.lat as number
                const lng = place.lng as number
                warnIfSuspiciousCoords(lat, lng, `place=${place.slug}`)
                return new ymaps.Placemark(
                  [lat, lng],
                  {
                    balloonContentBody: buildBalloonHtml(place as MapPlace),
                    hintContent: place.name,
                  },
                  {
                    preset: 'islands#darkOrangeCircleDotIcon',
                  }
                )
              }
            )

            clusterer.add(placemarks)
            map.geoObjects.add(clusterer)

            // Fit bounds по всем точкам, с паддингом и ограничением по зуму.
            const bounds = (clusterer as unknown as YClustererInstance).getBounds?.()
            if (bounds) {
              map.setBounds(bounds, { checkZoomRange: true, zoomMargin: FIT_PADDING })
              const currentZoom = map.getZoom?.()
              if (typeof currentZoom === 'number' && currentZoom > MAX_ZOOM) {
                map.setZoom?.(MAX_ZOOM)
              }
            }
          } else {
            // Если координат нет — остаёмся на Алматы.
            map.setCenter?.(ALMATY_CENTER_LAT_LNG, DEFAULT_ZOOM)
          }
        })
      })
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить карту.'
        setError(message)
      })

    return () => {
      disposed = true
      if (map) map.destroy()
    }
  }, [apiKey, safePlaces])

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Добавьте `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` в `.env.local`, чтобы увидеть карту.
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 
        На мобилке слегка "вытягиваем" сам canvas карты вниз и прячем лишнее через overflow-hidden,
        чтобы встроенный нижний брендинг Яндекс.Карт уходил за пределы viewport карты.
      */}
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-0 bottom-[-56px] rounded-2xl sm:bottom-0"
      />
      {safePlaces.length === 0 ? (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-sm text-gray-700 shadow-sm backdrop-blur">
          Нет координат у заведений — добавьте lat/lng в админке, пока карта центрируется на Алматы.
        </div>
      ) : null}
      {process.env.NODE_ENV !== 'production' ? (
        <div className="pointer-events-none absolute bottom-20 left-4 z-10 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-xs text-gray-600 shadow-sm backdrop-blur sm:bottom-4">
          Всего: {places.length} · с координатами: {safePlaces.length}
        </div>
      ) : null}
    </div>
  )
}
