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

type YMapGeoObjects = {
  add: (item: unknown) => void
}

type YMapV21Instance = {
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

type YMapsV21Api = {
  ready: (callback: () => void) => void
  Map: new (container: HTMLElement, state: unknown, options?: unknown) => YMapV21Instance
  Placemark: new (coords: [number, number], properties?: unknown, options?: unknown) => unknown
  Clusterer: new (options?: unknown) => YClustererInstance
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
const MARKERS_SOURCE = 'restaurants-markers'

// JS API v3: [lng, lat]. JS API 2.1: [lat, lng].
const ALMATY_CENTER_LNG_LAT: LngLat = [76.889709, 43.238949]
const ALMATY_CENTER_LAT_LNG: [number, number] = [43.238949, 76.889709]
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

function getYmaps3(): YMaps3Api | undefined {
  return (globalThis as { ymaps3?: YMaps3Api }).ymaps3 ?? window.ymaps3
}

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

function waitForYmaps3(timeoutMs = 20_000): Promise<YMaps3Api> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    const tick = () => {
      const ymaps3 = getYmaps3()
      if (ymaps3) {
        resolve(ymaps3)
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('API Яндекс.Карт v3 не инициализировано. Проверьте ключ и HTTP Referer.'))
        return
      }

      window.setTimeout(tick, 50)
    }

    tick()
  })
}

function removeMapScripts() {
  for (const id of [LEGACY_SCRIPT_ID, SCRIPT_ID]) {
    document.getElementById(id)?.remove()
  }
  delete window.ymaps
  delete (globalThis as { ymaps3?: YMaps3Api }).ymaps3
  delete window.ymaps3
}

async function loadYandexMapsV3(apiKey: string): Promise<YMaps3Api> {
  const scriptUrl = `https://api-maps.yandex.ru/v3/?lang=ru_RU&apikey=${encodeURIComponent(apiKey)}`
  const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null

  if (existingScript && existingScript.src !== scriptUrl) {
    removeMapScripts()
  }

  if (getYmaps3()) {
    const ymaps3 = getYmaps3() as YMaps3Api
    await waitForYmaps3Ready(ymaps3)
    return ymaps3
  }

  document.getElementById(LEGACY_SCRIPT_ID)?.remove()
  delete window.ymaps

  let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = scriptUrl
    script.async = true

    await new Promise<void>((resolve, reject) => {
      script!.addEventListener('load', () => resolve(), { once: true })
      script!.addEventListener('error', () => reject(new Error('Не удалось загрузить скрипт Яндекс.Карт v3.')), { once: true })
      document.head.appendChild(script!)
    })
  }

  const ymaps3 = await waitForYmaps3()

  await waitForYmaps3Ready(ymaps3)
  return ymaps3
}

function waitForYmaps3Ready(ymaps3: YMaps3Api, timeoutMs = 20_000): Promise<void> {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'unknown'

  return Promise.race([
    ymaps3.ready,
    new Promise<void>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            `Таймаут ymaps3.ready. Добавьте «${host}» в HTTP Referer ключа Яндекс.Карт и подождите ~15 мин.`
          )
        )
      }, timeoutMs)
    }),
  ]).catch((readyError: unknown) => {
    const message = readyError instanceof Error ? readyError.message : String(readyError)
    throw new Error(`Яндекс.Карты v3: ${message}`)
  })
}

function waitForYmapsV21(timeoutMs = 20_000): Promise<YMapsV21Api> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    const tick = () => {
      if (window.ymaps) {
        resolve(window.ymaps as YMapsV21Api)
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('API Яндекс.Карт 2.1 не инициализировано.'))
        return
      }

      window.setTimeout(tick, 50)
    }

    tick()
  })
}

async function loadYandexMapsV21(apiKey: string): Promise<YMapsV21Api> {
  const scriptUrl = `https://api-maps.yandex.ru/2.1/?lang=ru_RU&apikey=${encodeURIComponent(apiKey)}`
  const existingScript = document.getElementById(LEGACY_SCRIPT_ID) as HTMLScriptElement | null

  if (existingScript && existingScript.src !== scriptUrl) {
    removeMapScripts()
  }

  if (window.ymaps) {
    const ymaps = window.ymaps as YMapsV21Api
    await new Promise<void>((resolve) => {
      ymaps.ready(() => resolve())
    })
    return ymaps
  }

  document.getElementById(SCRIPT_ID)?.remove()
  delete (globalThis as { ymaps3?: YMaps3Api }).ymaps3
  delete window.ymaps3

  let script = document.getElementById(LEGACY_SCRIPT_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = LEGACY_SCRIPT_ID
    script.src = scriptUrl
    script.async = true

    await new Promise<void>((resolve, reject) => {
      script!.addEventListener('load', () => resolve(), { once: true })
      script!.addEventListener('error', () => reject(new Error('Не удалось загрузить скрипт Яндекс.Карт 2.1.')), { once: true })
      document.head.appendChild(script!)
    })
  }

  const ymaps = await waitForYmapsV21()
  await new Promise<void>((resolve) => {
    ymaps.ready(() => resolve())
  })
  return ymaps
}

function initMapV21(
  container: HTMLDivElement,
  ymaps: YMapsV21Api,
  safePlaces: MapPlace[]
): YMapV21Instance {
  const map = new ymaps.Map(
    container,
    {
      center: ALMATY_CENTER_LAT_LNG,
      zoom: DEFAULT_ZOOM,
      controls: ['zoomControl', 'geolocationControl'],
    },
    {
      suppressMapOpenBlock: true,
      yandexMapDisablePoiInteractivity: true,
    }
  )

  if (safePlaces.length > 0) {
    const clusterer = new ymaps.Clusterer({
      preset: 'islands#darkOrangeClusterIcons',
      groupByCoordinates: false,
    })

    const placemarks = safePlaces.map((place) => {
      const lat = place.lat as number
      const lng = place.lng as number
      warnIfSuspiciousCoords(lat, lng, `place=${place.slug}`)
      return new ymaps.Placemark(
        [lat, lng],
        {
          balloonContentBody: buildBalloonHtml(place),
          hintContent: place.name,
        },
        {
          preset: 'islands#darkOrangeCircleDotIcon',
        }
      )
    })

    clusterer.add(placemarks)
    map.geoObjects.add(clusterer)

    const bounds = clusterer.getBounds?.()
    if (bounds) {
      map.setBounds(bounds, { checkZoomRange: true, zoomMargin: FIT_PADDING })
      const currentZoom = map.getZoom?.()
      if (typeof currentZoom === 'number' && currentZoom > MAX_ZOOM) {
        map.setZoom?.(MAX_ZOOM)
      }
    }
  } else {
    map.setCenter?.(ALMATY_CENTER_LAT_LNG, DEFAULT_ZOOM)
  }

  return map
}

async function initMapV3(
  container: HTMLDivElement,
  ymaps3: YMaps3Api,
  safePlaces: MapPlace[],
  onOpenBalloon: (balloon: HTMLDivElement) => void
): Promise<YMapInstance> {
  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapFeatureDataSource,
    YMapLayer,
    YMapControls,
    YMapMarker,
  } = ymaps3

  const map = new YMap(container, {
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
  map.addChild(new YMapFeatureDataSource({ id: MARKERS_SOURCE }))
  map.addChild(
    new YMapLayer({
      source: MARKERS_SOURCE,
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
    const coordinates: LngLat[] = []

    for (const place of safePlaces) {
      const lat = place.lat as number
      const lng = place.lng as number
      warnIfSuspiciousCoords(lat, lng, `place=${place.slug}`)
      coordinates.push([lng, lat])

      map.addChild(
        new YMapMarker(
          {
            coordinates: [lng, lat],
            source: MARKERS_SOURCE,
          },
          createRestaurantMarkerElement(place, onOpenBalloon)
        )
      )
    }

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

  return map
}

export function YandexRestaurantsMap({ places }: { places: MapPlace[] }) {
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapEngine, setMapEngine] = useState<'v3' | 'v21' | null>(null)
  const [v3FallbackReason, setV3FallbackReason] = useState<string | null>(null)

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

    let map: YMapInstance | YMapV21Instance | null = null
    let disposed = false
    let openBalloon: HTMLDivElement | null = null

    const closeOpenBalloon = () => {
      if (openBalloon) {
        openBalloon.style.display = 'none'
        openBalloon = null
      }
    }

    const handleOpenBalloon = (balloon: HTMLDivElement) => {
      if (openBalloon && openBalloon !== balloon) {
        openBalloon.style.display = 'none'
      }
      openBalloon = balloon
    }

    const handleDocumentClick = () => {
      closeOpenBalloon()
    }

    const init = async () => {
      if (disposed || !containerRef.current) return

      setMapEngine(null)
      setV3FallbackReason(null)

      try {
        const ymaps3 = await loadYandexMapsV3(apiKey)
        if (disposed || !containerRef.current) return

        map = await initMapV3(containerRef.current, ymaps3, safePlaces, handleOpenBalloon)
        setMapEngine('v3')
        document.addEventListener('click', handleDocumentClick)
        return
      } catch (v3Error: unknown) {
        const reason = v3Error instanceof Error ? v3Error.message : String(v3Error)
        safeLog.warn('[map] v3 init failed, falling back to 2.1', { message: reason })
        setV3FallbackReason(reason)
        removeMapScripts()
      }

      if (disposed || !containerRef.current) return

      containerRef.current.replaceChildren()
      const ymaps = await loadYandexMapsV21(apiKey)
      if (disposed || !containerRef.current) return

      map = initMapV21(containerRef.current, ymaps, safePlaces)
      setMapEngine('v21')
    }

    init().catch((loadError: unknown) => {
      safeLog.error('[map] init failed', loadError)
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
        <div className="pointer-events-none absolute bottom-20 left-4 z-10 max-w-xs space-y-2 sm:bottom-4">
          <div className="rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
            Всего: {places.length} · с координатами: {safePlaces.length}
          </div>
          {mapEngine ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs shadow-sm backdrop-blur ${
                mapEngine === 'v3'
                  ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                  : 'border-amber-200 bg-amber-50/95 text-amber-900'
              }`}
            >
              API: {mapEngine === 'v3' ? 'v3 (POI скрыты)' : '2.1 (fallback, POI видны)'}
              {mapEngine === 'v21' && v3FallbackReason ? (
                <div className="mt-1 leading-snug opacity-90">{v3FallbackReason}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
