import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import {
  formatBenefitLabel,
  formatKudafestBadgeDate,
  formatOfferChipLabel,
  pickTopOffers,
} from '@/lib/offers'
import { formatStatusForCard } from '@/lib/opening-hours'
import { formatDistanceFromUser } from '@/lib/distance'
import type { RestaurantWithStatus } from '@/lib/types'

type Props = {
  restaurant: RestaurantWithStatus
  distanceKm?: number | null
}

export function RestaurantCard({ restaurant, distanceKm }: Props) {
  const r = restaurant
  const cuisines = [r.cuisine, r.cuisine_2, r.cuisine_3].filter(Boolean) as string[]
  const topOffers = pickTopOffers(r.offers, 3)
  const benefitLabel = formatBenefitLabel(r.offers)
  const status = formatStatusForCard(r.openStatus)
  const isOpen = r.openStatus.isOpen
  const showDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm)

  return (
    <Link
      href={`/r/${r.slug}`}
      className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.04),0_12px_28px_-10px_rgba(0,0,0,0.10)]"
    >
      <div
        className={`relative h-[160px] w-full overflow-hidden bg-neutral-100 ${
          isOpen ? '' : 'grayscale-[0.5] opacity-85'
        }`}
      >
        {r.cover_photo_url ? (
          <Image
            src={r.cover_photo_url}
            alt={r.restaurant_name}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-300">
            Нет фото
          </div>
        )}

        {topOffers.length > 0 ? (
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex max-w-[70%] flex-col items-start gap-[5px]">
            {topOffers.map((offer, i) => {
              if (offer.offer_type === 'kudafest_set' && offer.end_date) {
                return (
                  <span
                    key={`${r.id}-kudafest-${i}`}
                    className="max-w-full truncate rounded-md bg-[#5B21B6]/92 px-2.5 py-[5px] text-xs font-medium text-white backdrop-blur-md"
                  >
                    {formatKudafestBadgeDate(offer.end_date)}
                  </span>
                )
              }

              const label = formatOfferChipLabel(offer.offer_type, offer.offer_title)
              const isTwoFor1 = offer.offer_type === '2for1'
              return (
                <span
                  key={`${r.id}-offer-${i}`}
                  className={`max-w-full truncate rounded-md px-2.5 py-[5px] text-xs font-medium text-white backdrop-blur-md ${
                    isTwoFor1 ? 'bg-[#D85A30]/92' : 'bg-[#0F6E56]/92'
                  }`}
                >
                  {label}
                </span>
              )
            })}
          </div>
        ) : null}

        {benefitLabel ? (
          <div className="pointer-events-none absolute right-2.5 top-2.5 rounded px-2.5 py-1 text-xs font-medium text-neutral-900 bg-white/96 backdrop-blur-sm">
            {benefitLabel}
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-[14px]">
        <h3 className="text-[15px] font-medium leading-tight text-neutral-900">
          {r.restaurant_name}
        </h3>

        {cuisines.length > 0 ? (
          <p className="mt-0.5 text-xs text-neutral-500">
            {cuisines.join(' · ')}
          </p>
        ) : null}

        <div className="mt-3.5 flex items-center gap-1.5 text-xs">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              isOpen ? 'bg-success' : 'bg-neutral-400'
            }`}
          />
          <span
            className={`font-medium ${
              isOpen ? 'text-success' : 'text-neutral-500'
            }`}
          >
            {status.label}
          </span>
          {status.detail ? (
            <span className="text-neutral-500">· {status.detail}</span>
          ) : null}
        </div>

        {r.address ? (
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-neutral-600">
            <MapPin size={11} className="shrink-0 opacity-55" aria-hidden="true" />
            <span className="truncate">
              {r.address}
              {showDistance ? ` · ${formatDistanceFromUser(distanceKm as number)}` : ''}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  )
}
