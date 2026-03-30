'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const OPTIMIZED_IMAGE_HOSTS = ['supabase.co', 'supabase.in']

function isOptimizedImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return OPTIMIZED_IMAGE_HOSTS.some((h) => host === h || host.endsWith('.' + h))
  } catch {
    return false
  }
}

type RestaurantPhotoGalleryProps = {
  photoUrls: string[]
  restaurantName: string
}

export function RestaurantPhotoGallery({ photoUrls, restaurantName }: RestaurantPhotoGalleryProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const syncIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el || photoUrls.length <= 1) return
    const w = el.clientWidth
    if (w <= 0) return
    const i = Math.round(el.scrollLeft / w)
    setIndex(Math.max(0, Math.min(photoUrls.length - 1, i)))
  }, [photoUrls.length])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', syncIndexFromScroll, { passive: true })
    return () => el.removeEventListener('scroll', syncIndexFromScroll)
  }, [syncIndexFromScroll])

  const scrollBySlide = useCallback(
    (dir: -1 | 1) => {
      const el = scrollerRef.current
      if (!el) return
      const w = el.clientWidth
      const current = Math.round(el.scrollLeft / w)
      const next = Math.max(0, Math.min(photoUrls.length - 1, current + dir))
      el.scrollTo({ left: next * w, behavior: 'smooth' })
      setIndex(next)
    },
    [photoUrls.length],
  )

  if (photoUrls.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-gray-50 text-sm text-gray-300">
        Нет фото
      </div>
    )
  }

  if (photoUrls.length === 1) {
    const url = photoUrls[0]
    return (
      <div className="relative aspect-[4/3] bg-gray-100">
        {isOptimizedImageUrl(url) ? (
          <Image
            src={url}
            alt={restaurantName}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 720px, 100vw"
            priority
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={restaurantName} className="h-full w-full object-cover" />
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photoUrls.map((url, idx) => (
          <div key={url} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-gray-100">
            {isOptimizedImageUrl(url) ? (
              <Image
                src={url}
                alt={`${restaurantName}, фото ${idx + 1}`}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 720px, 100vw"
                priority={idx === 0}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={`${restaurantName}, фото ${idx + 1}`}
                className="h-full w-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            )}
          </div>
        ))}
      </div>

      {/* Desktop-only navigation */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden md:block">
        <button
          type="button"
          aria-label="Предыдущее фото"
          disabled={index <= 0}
          onClick={() => scrollBySlide(-1)}
          className="pointer-events-auto absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-35"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Следующее фото"
          disabled={index >= photoUrls.length - 1}
          onClick={() => scrollBySlide(1)}
          className="pointer-events-auto absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-35"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
        {photoUrls.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 w-1.5 rounded-full shadow-sm transition-colors ${
              idx === index ? 'bg-white' : 'bg-white/60'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}
