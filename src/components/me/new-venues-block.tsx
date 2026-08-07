import Link from 'next/link'
import Image from 'next/image'
import type { NewestRestaurant } from '@/lib/home/load-newest-restaurants'
import { CITY_LABELS, isCity } from '@/lib/cities'

export function NewVenuesBlock({ venues }: { venues: NewestRestaurant[] }) {
  if (venues.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">Новое в kudaclub</h2>
      <ul className="space-y-3">
        {venues.map((venue) => {
          const cityLabel = isCity(venue.city)
            ? CITY_LABELS[venue.city]
            : venue.city
          return (
            <li key={venue.id}>
              <Link
                href={`/r/${venue.slug}`}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:border-neutral-300"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {venue.photoUrl ? (
                    <Image
                      src={venue.photoUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">
                    {venue.restaurant_name}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                    {[cityLabel, venue.cuisine].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
