'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type RestaurantHeroGalleryProps = {
  photoUrls: string[]
  restaurantName: string
}

export function RestaurantHeroGallery({ photoUrls, restaurantName }: RestaurantHeroGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
  }, [])

  if (photoUrls.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center bg-neutral-100 text-sm text-neutral-400"
        style={{ height: '220px' }}
      >
        Нет фото
      </div>
    )
  }

  const heroPhoto = photoUrls[0]
  const secondaryPhotos = photoUrls.slice(1, 3)
  const remainingCount = Math.max(photoUrls.length - 3, 0)

  return (
    <>
      {/* Mobile: горизонтальный snap-скролл */}
      <div
        className="flex w-full snap-x snap-mandatory overflow-x-auto md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: '220px' }}
      >
        {photoUrls.map((url, idx) => (
          <button
            key={url}
            type="button"
            onClick={() => openLightbox(idx)}
            className="relative block h-full w-full shrink-0 snap-center bg-neutral-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${restaurantName}, фото ${idx + 1}`}
              className="h-full w-full object-cover"
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
          </button>
        ))}
      </div>

      {/* Desktop: grid 2fr 1fr 1fr */}
      <div
        className="hidden w-full md:grid"
        style={{
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: '4px',
          height: '280px',
        }}
      >
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="relative block h-full w-full overflow-hidden bg-neutral-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroPhoto}
            alt={`${restaurantName}, главное фото`}
            className="h-full w-full object-cover"
          />
        </button>

        <div className="grid h-full grid-rows-1 gap-1">
          {secondaryPhotos[0] ? (
            <button
              type="button"
              onClick={() => openLightbox(1)}
              className="relative block h-full w-full overflow-hidden bg-neutral-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={secondaryPhotos[0]}
                alt={`${restaurantName}, фото 2`}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className="h-full w-full bg-neutral-100" />
          )}
        </div>

        <div className="grid h-full grid-rows-1 gap-1">
          {secondaryPhotos[1] ? (
            <button
              type="button"
              onClick={() => openLightbox(2)}
              className="relative block h-full w-full overflow-hidden bg-neutral-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={secondaryPhotos[1]}
                alt={`${restaurantName}, фото 3`}
                className="h-full w-full object-cover"
              />
              {remainingCount > 0 ? (
                <span
                  className="absolute right-3 bottom-3 rounded-md bg-black/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur"
                  style={{ fontSize: '11px', padding: '5px 10px' }}
                >
                  + {remainingCount} фото
                </span>
              ) : null}
            </button>
          ) : (
            <div className="h-full w-full bg-neutral-100" />
          )}
        </div>
      </div>

      {lightboxIndex != null ? (
        <Lightbox
          photoUrls={photoUrls}
          startIndex={lightboxIndex}
          restaurantName={restaurantName}
          onClose={closeLightbox}
        />
      ) : null}
    </>
  )
}

type LightboxProps = {
  photoUrls: string[]
  startIndex: number
  restaurantName: string
  onClose: () => void
}

function Lightbox({ photoUrls, startIndex, restaurantName, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photoUrls.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, photoUrls.length])

  if (typeof document === 'undefined') return null

  const total = photoUrls.length

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Галерея фотографий"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} />
      </button>

      <div
        className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white"
        aria-live="polite"
      >
        {index + 1} / {total}
      </div>

      {total > 1 ? (
        <button
          type="button"
          aria-label="Предыдущее"
          disabled={index <= 0}
          onClick={(e) => {
            e.stopPropagation()
            setIndex((i) => Math.max(0, i - 1))
          }}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}

      {total > 1 ? (
        <button
          type="button"
          aria-label="Следующее"
          disabled={index >= total - 1}
          onClick={(e) => {
            e.stopPropagation()
            setIndex((i) => Math.min(total - 1, i + 1))
          }}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      ) : null}

      <div
        className="relative max-h-[90vh] max-w-[95vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrls[index]}
          alt={`${restaurantName}, фото ${index + 1}`}
          className="max-h-[90vh] max-w-[95vw] object-contain"
        />
      </div>
    </div>,
    document.body
  )
}
