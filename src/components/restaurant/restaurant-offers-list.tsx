'use client'

import { Clock } from 'lucide-react'
import {
  formatEstimatedValue,
  formatOfferTitle,
  type OfferType,
} from '@/lib/offers'
import { trackGoal } from '@/lib/analytics-client'
import {
  META_OFFER_DEFAULT_VALUE_KZT,
  trackMetaPixel,
} from '@/lib/meta-pixel-client'

export type RestaurantOffer = {
  id: string
  offer_type: OfferType
  offer_title: string
  offer_terms_short: string
  estimated_value: number | null
  dish_photo_url: string | null
  takeaway_only: boolean
  usableHoursLabel: string | null
  isOutsideUsableHours: boolean
}

type RestaurantOffersListProps = {
  offers: RestaurantOffer[]
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  /** Вошёл и подтвердил телефон: кнопка ведёт сразу к коду. */
  isMember: boolean
}

export function RestaurantOffersList({
  offers,
  restaurantId,
  restaurantSlug,
  restaurantName,
  isMember,
}: RestaurantOffersListProps) {
  if (offers.length === 0) {
    return (
      <div className="rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400">
        Пока нет активных предложений
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ gap: '12px' }}>
      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          restaurantId={restaurantId}
          restaurantSlug={restaurantSlug}
          restaurantName={restaurantName}
          isMember={isMember}
        />
      ))}
    </div>
  )
}

type OfferCardProps = {
  offer: RestaurantOffer
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  isMember: boolean
}

function OfferCard(props: OfferCardProps) {
  const { offer } = props
  const title = formatOfferTitle(offer.offer_type, offer.offer_title)
  const benefitLabel = formatEstimatedValue(offer.estimated_value)
  const typeBadge = formatTypeBadge(offer.offer_type)

  const hasPhoto = Boolean(offer.dish_photo_url)

  return (
    <div
      className="flex overflow-hidden rounded-xl bg-white"
      style={{ borderWidth: '0.5px', borderStyle: 'solid', borderColor: 'rgb(229 229 229)' }}
    >
      {hasPhoto ? (
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ width: 'clamp(100px, 30vw, 120px)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={offer.dish_photo_url!}
            alt={offer.offer_title}
            className="h-full w-full object-cover"
          />

          <span
            className="absolute font-medium text-white"
            style={{
              top: '8px',
              left: '8px',
              fontSize: '10px',
              padding: '3px 7px',
              borderRadius: '4px',
              background: typeBadge.bg,
              zIndex: 1,
            }}
          >
            {typeBadge.label}
          </span>
        </div>
      ) : null}

      {/* RIGHT: content */}
      <div className="min-w-0 flex-1" style={{ padding: '14px 16px' }}>
        <h3
          className="text-sm font-medium leading-[1.35] text-neutral-900"
          style={{ marginBottom: '4px' }}
        >
          {title}
        </h3>

        {offer.offer_terms_short ? (
          <p
            className="whitespace-pre-line text-xs leading-[1.5] text-neutral-600"
            style={{ marginBottom: '10px' }}
          >
            {offer.offer_terms_short}
          </p>
        ) : null}

        {benefitLabel || offer.takeaway_only ? (
          <div
            className="flex flex-wrap items-center"
            style={{ gap: '6px', marginBottom: '10px' }}
          >
            {benefitLabel ? (
              <span
                className="inline-block font-medium"
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: '#FAECE7',
                  color: '#993C1D',
                }}
              >
                {benefitLabel}
              </span>
            ) : null}
            {offer.takeaway_only ? (
              <span
                className="inline-block font-medium"
                style={{
                  fontSize: '12px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: '#F4F4F5',
                  color: '#525252',
                }}
              >
                Только на вынос
              </span>
            ) : null}
          </div>
        ) : null}

        {offer.usableHoursLabel ? (
          <div
            className="flex items-center text-neutral-500"
            style={{ fontSize: '11px', gap: '4px', marginBottom: '10px' }}
          >
            <Clock size={11} style={{ opacity: 0.7 }} aria-hidden="true" />
            <span>{offer.usableHoursLabel}</span>
          </div>
        ) : null}

        <OfferCta {...props} />
      </div>
    </div>
  )
}

function OfferCta({
  offer,
  restaurantId,
  restaurantSlug,
  restaurantName,
  isMember,
}: OfferCardProps) {
  const baseStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '9px 14px',
    borderRadius: '8px',
    fontWeight: 500,
  }

  const disabledLabel =
    offer.isOutsideUsableHours && offer.usableHoursLabel ? offer.usableHoursLabel : null

  if (disabledLabel) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed text-neutral-500"
        style={{ ...baseStyle, background: '#f5f5f5' }}
      >
        {disabledLabel}
      </button>
    )
  }

  const redeemPath = `/app/redeem/${restaurantId}/${offer.id}`
  const href = isMember ? redeemPath : `/login?next=${encodeURIComponent(redeemPath)}`

  return (
    <a
      href={href}
      onClick={() => {
        trackMetaPixel('AddToCart', {
          content_name: formatOfferTitle(offer.offer_type, offer.offer_title),
          content_ids: [offer.id],
          value: offer.estimated_value ?? META_OFFER_DEFAULT_VALUE_KZT,
          currency: 'KZT',
        })
        trackGoal('offer_get_click', {
          restaurant_slug: restaurantSlug,
          restaurant_name: restaurantName,
          restaurant_id: restaurantId,
          offer_id: offer.id,
          offer_type: offer.offer_type,
          is_member: isMember,
        })
      }}
      className="block w-full text-center text-white transition-colors hover:opacity-95"
      style={{ ...baseStyle, background: '#D85A30' }}
    >
      Получить код
    </a>
  )
}

function formatTypeBadge(offerType: OfferType): { label: string; bg: string } {
  if (offerType === '2for1') {
    return { label: '1+1', bg: '#D85A30' }
  }
  if (offerType === 'kudafest_set') {
    return { label: 'Kudafest', bg: '#5B21B6' }
  }
  return { label: 'В подарок', bg: '#0F6E56' }
}
