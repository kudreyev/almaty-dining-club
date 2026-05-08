'use client'

import { useCallback, useState } from 'react'
import { Clock } from 'lucide-react'
import { PaywallModal } from '@/components/paywall-modal'
import {
  formatEstimatedValue,
  formatOfferCooldownText,
  formatOfferTitle,
  type OfferType,
} from '@/lib/offers'
import { ruDayWordAfterNumber } from '@/lib/ru-plural'
import { trackGoal } from '@/lib/analytics-client'

export type RestaurantOffer = {
  id: string
  offer_type: OfferType
  offer_title: string
  offer_terms_short: string
  estimated_value: number | null
  cooldown_days: number | null
  dish_photo_url: string | null
}

type RestaurantOffersListProps = {
  offers: RestaurantOffer[]
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  hasSubscription: boolean
  /** offerId → days left in cooldown (e.g. 4). Если оффер не в кулдауне — отсутствует в map. */
  cooldownDaysLeftByOfferId: Record<string, number>
}

export function RestaurantOffersList({
  offers,
  restaurantId,
  restaurantSlug,
  restaurantName,
  hasSubscription,
  cooldownDaysLeftByOfferId,
}: RestaurantOffersListProps) {
  const [showPaywall, setShowPaywall] = useState(false)

  const handlePaywallOpen = useCallback(
    (e: React.MouseEvent, offer: RestaurantOffer) => {
      e.preventDefault()
      trackGoal('offer_get_click', {
        restaurant_slug: restaurantSlug,
        restaurant_name: restaurantName,
        offer_type: offer.offer_type,
        has_subscription: false,
      })
      setShowPaywall(true)
    },
    [restaurantName, restaurantSlug],
  )

  const handlePaywallClose = useCallback(() => setShowPaywall(false), [])

  if (offers.length === 0) {
    return (
      <div className="rounded-xl bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-400">
        Пока нет активных офферов
      </div>
    )
  }

  return (
    <>
      {showPaywall ? <PaywallModal onClose={handlePaywallClose} /> : null}

      <div className="flex flex-col" style={{ gap: '12px' }}>
        {offers.map((offer) => {
          const daysLeft = cooldownDaysLeftByOfferId[offer.id]
          const isOnCooldown = hasSubscription && typeof daysLeft === 'number' && daysLeft > 0
          return (
            <OfferCard
              key={offer.id}
              offer={offer}
              restaurantId={restaurantId}
              restaurantSlug={restaurantSlug}
              restaurantName={restaurantName}
              hasSubscription={hasSubscription}
              isOnCooldown={isOnCooldown}
              daysLeft={daysLeft ?? 0}
              onPaywallOpen={handlePaywallOpen}
            />
          )
        })}
      </div>
    </>
  )
}

type OfferCardProps = {
  offer: RestaurantOffer
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  hasSubscription: boolean
  isOnCooldown: boolean
  daysLeft: number
  onPaywallOpen: (e: React.MouseEvent, offer: RestaurantOffer) => void
}

function OfferCard({
  offer,
  restaurantId,
  restaurantSlug,
  restaurantName,
  hasSubscription,
  isOnCooldown,
  daysLeft,
  onPaywallOpen,
}: OfferCardProps) {
  const title = formatOfferTitle(offer.offer_type, offer.offer_title)
  const benefitLabel = formatEstimatedValue(offer.estimated_value)
  const cooldownLabel = formatOfferCooldownText(offer.cooldown_days)
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
            className="text-xs leading-[1.5] text-neutral-600"
            style={{ marginBottom: '10px' }}
          >
            {offer.offer_terms_short}
          </p>
        ) : null}

        {benefitLabel ? (
          <span
            className="inline-block font-medium"
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '4px',
              background: '#FAECE7',
              color: '#993C1D',
              marginBottom: '10px',
            }}
          >
            {benefitLabel}
          </span>
        ) : null}

        <div
          className="flex items-center text-neutral-500"
          style={{ fontSize: '11px', gap: '4px', marginBottom: '10px' }}
        >
          <Clock size={11} style={{ opacity: 0.7 }} aria-hidden="true" />
          <span>{cooldownLabel}</span>
        </div>

        {renderCta({
          offer,
          restaurantId,
          restaurantSlug,
          restaurantName,
          hasSubscription,
          isOnCooldown,
          daysLeft,
          onPaywallOpen,
        })}
      </div>
    </div>
  )
}

function renderCta({
  offer,
  restaurantId,
  restaurantSlug,
  restaurantName,
  hasSubscription,
  isOnCooldown,
  daysLeft,
  onPaywallOpen,
}: OfferCardProps) {
  const baseStyle: React.CSSProperties = {
    fontSize: '13px',
    padding: '9px 14px',
    borderRadius: '8px',
    fontWeight: 500,
  }

  if (hasSubscription && isOnCooldown) {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed text-neutral-500"
        style={{ ...baseStyle, background: '#f5f5f5' }}
      >
        Доступно через {daysLeft} {ruDayWordAfterNumber(daysLeft)}
      </button>
    )
  }

  if (hasSubscription) {
    return (
      <a
        href={`/app/redeem/${restaurantId}/${offer.id}`}
        onClick={() =>
          trackGoal('offer_get_click', {
            restaurant_slug: restaurantSlug,
            restaurant_name: restaurantName,
            offer_type: offer.offer_type,
            has_subscription: true,
          })
        }
        className="block w-full text-center text-white transition-colors hover:opacity-95"
        style={{ ...baseStyle, background: '#D85A30' }}
      >
        Получить
      </a>
    )
  }

  return (
    <a
      href={`/app/redeem/${restaurantId}/${offer.id}`}
      onClick={(e) => onPaywallOpen(e, offer)}
      className="block w-full text-center text-white transition-colors hover:opacity-95"
      style={{ ...baseStyle, background: '#D85A30' }}
    >
      Получить
    </a>
  )
}

function formatTypeBadge(offerType: OfferType): { label: string; bg: string } {
  if (offerType === '2for1') {
    return { label: '2 за 1', bg: '#D85A30' }
  }
  return { label: 'В подарок', bg: '#0F6E56' }
}
