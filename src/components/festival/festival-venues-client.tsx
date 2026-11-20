'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatSetPrice } from '@/lib/events'
import { formatSetOfferTitle } from '@/lib/offers'

export type FestivalVenueCard = {
  restaurantId: string
  slug: string
  name: string
  address: string
  cuisine: string
  offerTitle: string
  priceKzt: number
  isClubPartner: boolean
  isServing: boolean
  statusLabel: string
  nextOpenSortKey: number
}

type Props = {
  venues: FestivalVenueCard[]
  accentColor: string
  eventName: string
}

export function FestivalVenuesClient({ venues, accentColor, eventName }: Props) {
  const [servingNow, setServingNow] = useState(true)

  const visible = servingNow ? venues.filter((v) => v.isServing) : venues

  return (
    <div className="mt-8">
      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={servingNow}
          onChange={(e) => setServingNow(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Подают сейчас
      </label>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          {servingNow
            ? 'Сейчас ни одно заведение не подаёт сет. Снимите фильтр, чтобы увидеть все.'
            : 'Пока нет заведений.'}
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((venue) => (
            <li key={venue.restaurantId}>
              <Link
                href={`/r/${venue.slug}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[15px] font-medium text-neutral-900">{venue.name}</h2>
                  {venue.isClubPartner ? (
                    <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                      + 1+1 KudaClub
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {venue.cuisine}
                  {venue.address ? ` · ${venue.address}` : ''}
                </p>
                <p className="mt-3 text-sm font-medium" style={{ color: accentColor }}>
                  {formatSetOfferTitle(eventName)} · {formatSetPrice(venue.priceKzt)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {eventName}: {venue.statusLabel}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
