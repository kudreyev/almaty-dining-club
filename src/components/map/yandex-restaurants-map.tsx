'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type MapPlace = {
  slug: string
  name: string
  lat: number
  lng: number
  offerChips: string[]
  statusLine: string
}

type YMapGeoObjects = {
  add: (item: unknown) => void
}

type YMapInstance = {
  geoObjects: YMapGeoObjects
  setBounds: (bounds: unknown, options?: unknown) => void
  destroy: () => void
}

type YClustererInstance = {
  add: (items: unknown[]) => void
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
    .map((chip) => `<span style="display:inline-block;border-radius:9999px;background:#111827;color:#ffffff;padding:2px 8px;font-size:12px;line-height:18px;">${escapeHtml(chip)}</span>`)
    .join(' ')

  return `
    <div style="min-width:220px;max-width:260px;padding:4px 2px;font-family:Inter,system-ui,-apple-system,sans-serif;">
      <div style="font-size:16px;font-weight:600;color:#111827;">${escapeHtml(place.name)}</div>
      ${chips ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">${chips}</div>` : ''}
      <div style="margin-top:8px;font-size:13px;color:#4b5563;">${escapeHtml(place.statusLine)}</div>
      <a href="/r/${encodeURIComponent(place.slug)}" style="margin-top:10px;display:inline-block;border-radius:10px;background:#111827;color:#ffffff;text-decoration:none;padding:8px 12px;font-size:13px;font-weight:500;">
        Открыть заведение
      </a>
    </div>
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
    () => places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)),
    [places]
  )

  useEffect(() => {
    if (!containerRef.current || safePlaces.length === 0) return
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
              center: [43.238949, 76.889709],
              zoom: 12,
              controls: ['zoomControl', 'geolocationControl'],
            },
            {
              suppressMapOpenBlock: true,
            }
          )

          const clusterer = new ymaps.Clusterer({
            preset: 'islands#invertedNightClusterIcons',
            groupByCoordinates: false,
          })

          const placemarks = safePlaces.map((place) => new ymaps.Placemark(
            [place.lat, place.lng],
            {
              balloonContentBody: buildBalloonHtml(place),
              hintContent: place.name,
            },
            {
              preset: 'islands#blackCircleDotIcon',
            }
          ))

          clusterer.add(placemarks)
          map.geoObjects.add(clusterer)

          const bounds = safePlaces.map((place) => [place.lat, place.lng])
          map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 24 })
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

  if (safePlaces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Пока нет заведений с координатами.
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

  return <div ref={containerRef} className="h-full w-full rounded-2xl" />
}
