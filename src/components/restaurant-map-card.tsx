'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type RestaurantMapCardProps = {
  addressLine: string
  staticMapUrl: string | null
  backupMapUrl: string | null
  twoGisUrl: string | null
  mapTargetUrl: string
  yandexMapUrl: string
  noCoords: boolean
  instagramUrl?: string | null
  whatsappUrl?: string | null
  phone?: string | null
}

export function RestaurantMapCard({
  addressLine,
  staticMapUrl,
  backupMapUrl,
  twoGisUrl,
  mapTargetUrl,
  yandexMapUrl,
  noCoords,
  instagramUrl,
  whatsappUrl,
  phone,
}: RestaurantMapCardProps) {
  const [currentMapUrl, setCurrentMapUrl] = useState<string | null>(staticMapUrl)
  const [mapImageFailed, setMapImageFailed] = useState(false)
  const showImage = !noCoords && Boolean(currentMapUrl) && !mapImageFailed

  function handleImageError() {
    if (backupMapUrl && currentMapUrl !== backupMapUrl) {
      setCurrentMapUrl(backupMapUrl)
      return
    }
    setMapImageFailed(true)
  }

  return (
    <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-5">
      <h2 className="text-xl font-bold tracking-tight text-gray-950">Детали</h2>

      {noCoords ? null : (
        <a
          href={mapTargetUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block h-40 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 sm:h-48"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentMapUrl!}
              alt={`Карта: ${addressLine}`}
              className="h-full w-full object-cover"
              onError={handleImageError}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-50 px-4 text-center text-sm text-gray-500">
              Карта недоступна
            </div>
          )}
        </a>
      )}

      <p className="mt-3 text-sm text-gray-600">{addressLine}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {twoGisUrl ? (
          <Button
            href={twoGisUrl}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
            className="rounded-full"
          >
            Открыть в 2GIS
          </Button>
        ) : null}
        <Button
          href={yandexMapUrl}
          variant="secondary"
          size="sm"
          target="_blank"
          rel="noreferrer"
          className="rounded-full"
        >
          Открыть в Яндекс.Картах
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {instagramUrl ? (
          <Button
            href={instagramUrl}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
            className="rounded-full"
          >
            Instagram
          </Button>
        ) : null}
        {whatsappUrl ? (
          <Button
            href={whatsappUrl}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
            className="rounded-full"
          >
            WhatsApp
          </Button>
        ) : null}
        {phone ? (
          <Button href={`tel:${phone}`} variant="secondary" size="sm" className="rounded-full">
            Позвонить
          </Button>
        ) : null}
      </div>
    </div>
  )
}
