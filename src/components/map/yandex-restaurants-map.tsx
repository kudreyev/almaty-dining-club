'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { safeLog } from '@/lib/safe-logger'
import { getFallbackByContext, getUserFacingError } from '@/lib/safe-errors'

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

type LngLat = [number, number]
type LngLatBounds = [LngLat, LngLat]

type MapFeature = {
  type: 'Feature'
  id: string
  geometry: { coordinates: LngLat }
  properties: { place: MapPlace }
}

type YMapEntity = {
  addChild: (child: YMapEntity) => YMapEntity
}

type YMapInstance = YMapEntity & {
  setLocation: (location: {
    center?: LngLat
    zoom?: number
    bounds?: LngLatBounds
    duration?: number
    margin?: number | [number, number] | [number, number, number, number]
  }) => void
  destroy: () => void
}

type YMaps3Api = {
  ready: Promise<void>
  import: {
    (module: string): Promise<Record<string, unknown>>
    registerCdn: (template: string, packageName: string) => void
  }
  YMap: new (container: HTMLElement, props: unknown) => YMapInstance
  YMapDefaultSchemeLayer: new (props?: unknown) => YMapEntity
  YMapFeatureDataSource: new (props: { id: string }) => YMapEntity
  YMapLayer: new (props: { source: string; type: string; zIndex?: number }) => YMapEntity
  YMapControls: new (props?: { position?: string; orientation?: string }) => YMapEntity
  YMapMarker: new (props: { coordinates: LngLat; source?: string }, element: HTMLElement) => YMapEntity
}

declare global {
  interface Window {
    ymaps3?: YMaps3Api
    ymaps?: unknown
  }
}

const SCRIPT_ID = 'yandex-maps-v3-script'
const LEGACY_SCRIPT_ID = 'yandex-maps-script'
const CLUSTERER_SOURCE = 'restaurants-clusterer'

// JS API v3: порядок координат [lng, lat].
const ALMATY_CENTER_LNG_LAT: LngLat = [76.889709, 43.238949]
const DEFAULT_ZOOM = 12
const FIT_PADDING = 40
const MAX_ZOOM = 15

const MAP_SCHEME_CUSTOMIZATION = [
  {
    tags: {
      any: ['poi', 'business', 'food', 'shopping', 'medical', 'culture', 'gas_station'],
    },
    stylers: [{ visibility: 'off' }],
  },
]

function warnIfSuspiciousCoords(lat: number, lng: number, context: string) {
  if (process.env.NODE_ENV === 'production') return

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    safeLog.warn(`[map] suspicious coords (world bounds) ${context}`, {
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
    })
    return
  }

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

function getLngLatBounds(coordinates: LngLat[]): LngLatBounds | null {
  if (coordinates.length === 0) return null

  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity

  for (const [lng, lat] of coordinates) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

function createRestaurantMarkerElement(
  place: MapPlace,
  onOpen: (balloon: HTMLDivElement) => void
): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.display = 'flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  wrapper.title = place.name

  const balloon = document.createElement('div')
  balloon.style.display = 'none'
  balloon.style.position = 'absolute'
  balloon.style.bottom = 'calc(100% + 8px)'
  balloon.style.left = '50%'
  balloon.style.transform = 'translateX(-50%)'
  balloon.style.zIndex = '2'
  balloon.style.borderRadius = '12px'
  balloon.style.border = '1px solid #e5e5e5'
  balloon.style.background = '#ffffff'
  balloon.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'
  balloon.innerHTML = buildBalloonHtml(place)

  const dot = document.createElement('button')
  dot.type = 'button'
  dot.setAttribute('aria-label', place.name)
  dot.style.width = '14px'
  dot.style.height = '14px'
  dot.style.borderRadius = '9999px'
  dot.style.border = '2px solid #ffffff'
  dot.style.background = '#D85A30'
  dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.28)'
  dot.style.cursor = 'pointer'
  dot.style.padding = '0'

  dot.addEventListener('click', (event) => {
    event.stopPropagation()
    const isHidden = balloon.style.display === 'none'
    onOpen(balloon)
    balloon.style.display = isHidden ? 'block' : 'none'
  })

  wrapper.appendChild(balloon)
  wrapper.appendChild(dot)
  return wrapper
}

function createClusterElement(count: number): HTMLElement {
  const circle = document.createElement('div')
  circle.style.width = '36px'
  circle.style.height = '36px'
  circle.style.borderRadius = '9999px'
  circle.style.background = '#3f3f46'
  circle.style.color = '#ffffff'
  circle.style.display = 'flex'
  circle.style.alignItems = 'center'
  circle.style.justifyContent = 'center'
  circle.style.fontSize = '13px'
  circle.style.fontWeight = '600'
  circle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.24)'
  circle.textContent = String(count)
  return circle
}

function waitForYmaps3(): Promise<YMaps3Api> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timeoutMs = 15_000

    const tick = () => {
      if (window.ymaps3) {
        resolve(window.ymaps3)
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('API Яндекс.Карт v3 не инициализировано.'))
        return
      }

      window.setTimeout(tick, 50)
    }

    tick()
  })
}

function removeLegacyMapScript() {
  const legacyScript = document.getElementById(LEGACY_SCRIPT_ID)
  if (legacyScript) legacyScript.remove()
  delete window.ymaps
}

async function loadYandexMapsV3(apiKey: string): Promise<YMaps3Api> {
  removeLegacyMapScript()

  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (!existingScript) {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://api-maps.yandex.ru/v3/?lang=ru_RU&apikey=${encodeURIComponent(apiKey)}`
    script.async = true

    await new Promise<void>((resolve, reject) => {
      script.addEventListener('load', () => resolve(), { once: true })
      script.addEventListener('error', () => reject(new Error('Не удалось загрузить скрипт Яндекс.Карт v3.')), { once: true })
      document.head.appendChild(script)
    })
  } else if (!window.ymaps3) {
    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Не удалось загрузить скрипт Яндекс.Карт v3.')), { once: true })
    })
  }

  const ymaps3 = await waitForYmaps3()
  await ymaps3.ready
  return ymaps3
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
    let openBalloon: HTMLDivElement | null = null

    const closeOpenBalloon = () => {
      if (openBalloon) {
        openBalloon.style.display = 'none'
        openBalloon = null
      }
    }

    const handleDocumentClick = () => {
      closeOpenBalloon()
    }

    loadYandexMapsV3(apiKey)
      .then(async (ymaps3) => {
        if (disposed || !containerRef.current) return

        ymaps3.import.registerCdn(
          'https://cdn.jsdelivr.net/npm/{package}',
          '@yandex/ymaps3-clusterer@0.0.12'
        )

        const { YMapClusterer, clusterByGrid } = await ymaps3.import(
          '@yandex/ymaps3-clusterer'
        ) as {
          YMapClusterer: new (props: unknown) => YMapEntity
          clusterByGrid: (options: { gridSize: number }) => unknown
        }

        if (disposed || !containerRef.current) return

        const {
          YMap,
          YMapDefaultSchemeLayer,
          YMapFeatureDataSource,
          YMapLayer,
          YMapControls,
          YMapMarker,
        } = ymaps3

        map = new YMap(containerRef.current, {
          location: {
            center: ALMATY_CENTER_LNG_LAT,
            zoom: DEFAULT_ZOOM,
          },
          margin: [FIT_PADDING, FIT_PADDING, FIT_PADDING, FIT_PADDING],
          zoomRange: { min: 3, max: MAX_ZOOM },
        })

        map.addChild(
          new YMapDefaultSchemeLayer({
            theme: 'light',
            customization: MAP_SCHEME_CUSTOMIZATION,
          })
        )
        map.addChild(new YMapFeatureDataSource({ id: CLUSTERER_SOURCE }))
        map.addChild(
          new YMapLayer({
            source: CLUSTERER_SOURCE,
            type: 'markers',
            zIndex: 1800,
          })
        )

        try {
          ymaps3.import.registerCdn(
            'https://cdn.jsdelivr.net/npm/{package}',
            '@yandex/ymaps3-default-ui-theme@0.0.24'
          )
          const { YMapZoomControl, YMapGeolocationControl } = await ymaps3.import(
            '@yandex/ymaps3-default-ui-theme'
          ) as {
            YMapZoomControl: new (props?: unknown) => YMapEntity
            YMapGeolocationControl: new (props?: unknown) => YMapEntity
          }

          const controls = new YMapControls({ position: 'right', orientation: 'vertical' })
          controls.addChild(new YMapZoomControl({}))
          controls.addChild(new YMapGeolocationControl({}))
          map.addChild(controls)
        } catch (controlsError: unknown) {
          safeLog.warn('[map] failed to load map controls', {
            message: controlsError instanceof Error ? controlsError.message : String(controlsError),
          })
        }

        if (safePlaces.length > 0) {
          const coordinates = safePlaces.map((place) => {
            const lat = place.lat as number
            const lng = place.lng as number
            warnIfSuspiciousCoords(lat, lng, `place=${place.slug}`)
            return [lng, lat] as LngLat
          })

          const features: MapFeature[] = safePlaces.map((place, index) => ({
            type: 'Feature',
            id: place.slug || String(index),
            geometry: {
              coordinates: [place.lng as number, place.lat as number],
            },
            properties: { place: place as MapPlace },
          }))

          const marker = (feature: MapFeature) =>
            new YMapMarker(
              {
                coordinates: feature.geometry.coordinates,
                source: CLUSTERER_SOURCE,
              },
              createRestaurantMarkerElement(feature.properties.place, (balloon) => {
                if (openBalloon && openBalloon !== balloon) {
                  openBalloon.style.display = 'none'
                }
                openBalloon = balloon
              })
            )

          const cluster = (clusterCoordinates: LngLat, clusterFeatures: MapFeature[]) =>
            new YMapMarker(
              {
                coordinates: clusterCoordinates,
                source: CLUSTERER_SOURCE,
              },
              createClusterElement(clusterFeatures.length)
            )

          map.addChild(
            new YMapClusterer({
              method: clusterByGrid({ gridSize: 64 }),
              features,
              marker,
              cluster,
            })
          )

          const bounds = getLngLatBounds(coordinates)
          if (bounds) {
            map.setLocation({
              bounds,
              duration: 0,
              margin: [FIT_PADDING, FIT_PADDING, FIT_PADDING, FIT_PADDING],
            })
          }
        } else {
          map.setLocation({
            center: ALMATY_CENTER_LNG_LAT,
            zoom: DEFAULT_ZOOM,
            duration: 0,
          })
        }

        document.addEventListener('click', handleDocumentClick)
      })
      .catch((loadError: unknown) => {
        setError(getUserFacingError(loadError, getFallbackByContext('map')))
      })

    return () => {
      disposed = true
      document.removeEventListener('click', handleDocumentClick)
      closeOpenBalloon()
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
