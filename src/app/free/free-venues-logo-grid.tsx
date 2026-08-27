import Image from 'next/image'
import { extractBrandFromName } from '@/lib/brand'

export type FreeVenueLogo = {
  id: string
  name: string
  slug: string
  photoUrl: string | null
}

type FreeVenuesLogoGridProps = {
  venues: FreeVenueLogo[]
  cityLabel: string
}

/** Сетка логотипов/обложек партнёров (уникальные бренды). */
export function FreeVenuesLogoGrid({
  venues,
  cityLabel,
}: FreeVenuesLogoGridProps) {
  if (venues.length === 0) return null

  return (
    <section className="px-5 py-10 md:py-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-[11px] font-medium uppercase tracking-wider text-primary">
          Партнёры
        </p>
        <h2 className="mt-2 text-center text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
          Заведения kudaclub в {cityLabel}
        </h2>

        <ul className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5">
          {venues.map((venue) => {
            const brand =
              extractBrandFromName(venue.name) || venue.name
            const initial = brand.trim().charAt(0).toUpperCase() || '?'

            return (
              <li
                key={venue.id}
                className="flex flex-col items-center gap-2"
                title={brand}
              >
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 sm:h-[72px] sm:w-[72px]">
                  {venue.photoUrl ? (
                    <Image
                      src={venue.photoUrl}
                      alt={brand}
                      fill
                      sizes="72px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-neutral-400">
                      {initial}
                    </span>
                  )}
                </div>
                <span className="line-clamp-2 max-w-[88px] text-center text-[11px] leading-tight text-neutral-600">
                  {brand}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
