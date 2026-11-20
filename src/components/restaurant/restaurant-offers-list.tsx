'use client'

import { Clock } from 'lucide-react'
import {
  formatEstimatedValue,
  formatOfferTitle,
  formatSetOfferTitle,
  isFestivalSetOffer,
  type OfferType,
} from '@/lib/offers'
import { formatSetPrice, parseSetItems, type SetItem } from '@/lib/events'
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
  price_kzt?: number | null
  items?: SetItem[]
  event_slug?: string | null
  event_name?: string | null
  accent_color?: string | null
  schedule_summary?: string | null
  ctaDisabledLabel?: string | null
}

type FestivalBlock = {
  eventName: string
  endsLabel: string
  accentColor: string
  offers: RestaurantOffer[]
}

type RestaurantOffersListProps = {
  clubOffers: RestaurantOffer[]
  festivalBlocks?: FestivalBlock[]
  combineAllowed?: boolean
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  /** Вошёл и подтвердил телефон: кнопка ведёт сразу к коду. */
  isMember: boolean
}

export function RestaurantOffersList({
  clubOffers,
  festivalBlocks = [],
  combineAllowed = true,
  restaurantId,
  restaurantSlug,
  restaurantName,
  isMember,
}: RestaurantOffersListProps) {
  const hasClub = clubOffers.length > 0
  const hasFestival = festivalBlocks.some((b) => b.offers.length > 0)

  if (!hasClub && !hasFestival) {
    return (
      <div className="rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400">
        Пока нет активных предложений
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {hasClub ? (
        <div>
          <h2
            className="font-medium text-neutral-900"
            style={{ fontSize: '18px', marginBottom: '16px' }}
          >
            Всегда в KudaClub
          </h2>
          <div className="flex flex-col" style={{ gap: '12px' }}>
            {clubOffers.map((offer) => (
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
        </div>
      ) : null}

      {festivalBlocks.map((block) =>
        block.offers.length > 0 ? (
          <div key={block.eventName}>
            <h2
              className="font-medium text-neutral-900"
              style={{ fontSize: '18px', marginBottom: '6px' }}
            >
              <span style={{ color: block.accentColor }}>{block.eventName}</span>
              {' '}
              до {block.endsLabel}
            </h2>
            <div className="flex flex-col" style={{ gap: '12px', marginTop: '12px' }}>
              {block.offers.map((offer, index) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  restaurantId={restaurantId}
                  restaurantSlug={restaurantSlug}
                  restaurantName={restaurantName}
                  isMember={isMember}
                  showSetNumber={block.offers.length > 1}
                  setIndex={index}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}

      {hasClub && hasFestival && !combineAllowed ? (
        <p className="text-sm text-neutral-500">
          Сет и 1+1 в одном визите не суммируются
        </p>
      ) : null}
    </div>
  )
}

type OfferCardProps = {
  offer: RestaurantOffer
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  isMember: boolean
  showSetNumber?: boolean
  setIndex?: number
}

function OfferCard(props: OfferCardProps) {
  const { offer, showSetNumber = false, setIndex } = props
  const isSet = isFestivalSetOffer(offer)
  const title = isSet
    ? formatSetOfferTitle(offer.event_name, {
        showNumber: showSetNumber,
        offerTitle: offer.offer_title,
        index: setIndex,
      })
    : formatOfferTitle(offer.offer_type, offer.offer_title, offer.event_name)
  const benefitLabel = formatEstimatedValue(offer.estimated_value)
  const typeBadge = formatTypeBadge(offer)
  const items = offer.items ?? parseSetItems(undefined)
  const hasPhoto = Boolean(offer.dish_photo_url)
  const accent = offer.accent_color || '#5B21B6'

  return (
    <div
      className="flex overflow-hidden rounded-xl bg-white"
      style={{
        borderWidth: '0.5px',
        borderStyle: 'solid',
        borderColor: isSet ? `${accent}55` : 'rgb(229 229 229)',
      }}
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

      <div className="min-w-0 flex-1" style={{ padding: '14px 16px' }}>
        {!hasPhoto ? (
          <span
            className="mb-2 inline-block font-medium text-white"
            style={{
              fontSize: '10px',
              padding: '3px 7px',
              borderRadius: '4px',
              background: typeBadge.bg,
            }}
          >
            {typeBadge.label}
          </span>
        ) : null}

        <h3
          className="text-sm font-medium leading-[1.35] text-neutral-900"
          style={{ marginBottom: '4px' }}
        >
          {title}
        </h3>

        {isSet && typeof offer.price_kzt === 'number' ? (
          <p className="mb-2 text-sm font-semibold" style={{ color: accent }}>
            К оплате {formatSetPrice(offer.price_kzt)}
          </p>
        ) : null}

        {isSet && items.length > 0 ? (
          <ul className="mb-2 space-y-0.5 text-xs text-neutral-600">
            {items.map((item) => (
              <li key={item.title}>
                {item.title}
                {item.options?.length ? ` (${item.options.join(', ')})` : ''}
              </li>
            ))}
          </ul>
        ) : offer.offer_terms_short ? (
          <p
            className="whitespace-pre-line text-xs leading-[1.5] text-neutral-600"
            style={{ marginBottom: '10px' }}
          >
            {offer.offer_terms_short}
          </p>
        ) : null}

        {offer.schedule_summary ? (
          <p className="mb-2 text-[11px] text-neutral-500">{offer.schedule_summary}</p>
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

        {offer.usableHoursLabel && !isSet ? (
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
  showSetNumber = false,
  setIndex,
}: OfferCardProps) {
  const baseStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '9px 14px',
    borderRadius: '8px',
    fontWeight: 500,
  }

  const disabledLabel =
    offer.ctaDisabledLabel
    || (offer.isOutsideUsableHours
      ? offer.usableHoursLabel || 'Сейчас недоступно'
      : null)

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
  const accent = offer.accent_color || '#D85A30'

  return (
    <a
      href={href}
      onClick={() => {
        trackMetaPixel('AddToCart', {
          content_name: formatOfferTitle(
            offer.offer_type,
            offer.offer_title,
            offer.event_name,
            { showSetNumber, setIndex },
          ),
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
          event_slug: offer.event_slug ?? undefined,
          is_member: isMember,
        })
      }}
      className="block w-full text-center text-white transition-colors hover:opacity-95"
      style={{ ...baseStyle, background: isFestivalSetOffer(offer) ? accent : '#D85A30' }}
    >
      Получить код
    </a>
  )
}

function formatTypeBadge(offer: RestaurantOffer): { label: string; bg: string } {
  if (offer.offer_type === '2for1') {
    return { label: '1+1', bg: '#D85A30' }
  }
  if (isFestivalSetOffer(offer)) {
    return {
      label: formatSetOfferTitle(offer.event_name),
      bg: offer.accent_color || '#5B21B6',
    }
  }
  return { label: 'В подарок', bg: '#0F6E56' }
}
