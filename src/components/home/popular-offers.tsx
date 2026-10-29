import Link from 'next/link'
import { formatEstimatedValue, type OfferType } from '@/lib/offers'
import type { PopularOffer } from '@/lib/home/popular-offers'

type PopularOffersProps = {
  offers: PopularOffer[]
}

function badge(offerType: OfferType): { label: string; bg: string } {
  if (offerType === '2for1') return { label: '1+1', bg: '#D85A30' }
  if (offerType === 'kudafest_set') return { label: 'Kudafest', bg: '#5B21B6' }
  return { label: 'В подарок', bg: '#0F6E56' }
}

export function PopularOffers({ offers }: PopularOffersProps) {
  if (offers.length === 0) return null

  return (
    <section id="popular" className="scroll-mt-16 px-5 py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
          Популярное
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Ужин на двоих — за полцены
        </h2>

        <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {offers.map((offer) => {
            const b = badge(offer.offerType)
            const benefit = formatEstimatedValue(offer.estimatedValue)
            return (
              <li key={offer.restaurantSlug}>
                <Link
                  href={`/r/${offer.restaurantSlug}`}
                  className="flex h-full overflow-hidden rounded-2xl border border-neutral-100 bg-white transition-colors hover:border-neutral-300"
                >
                  {offer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={offer.photoUrl}
                      alt=""
                      loading="lazy"
                      className="h-auto w-[104px] shrink-0 object-cover"
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col p-4">
                    <span
                      className="self-start rounded px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ background: b.bg }}
                    >
                      {b.label}
                    </span>
                    <p className="mt-2 text-[15px] font-medium leading-snug text-neutral-900">
                      {offer.offerTitle}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500">в {offer.restaurantName}</p>
                    {benefit ? (
                      <p className="mt-auto pt-2 text-xs font-medium text-[#993C1D]">{benefit}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
