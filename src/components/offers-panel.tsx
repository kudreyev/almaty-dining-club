'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { PaywallModal } from '@/components/paywall-modal'
import { Button } from '@/components/ui/button'
import { formatEstimatedValue, formatOfferCooldownText, formatOfferHeadline } from '@/lib/offers'

type Offer = {
  id: string
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  offer_terms_full: string
  estimated_value?: number | null
  cooldown_days?: number | null
  requires_main_course: boolean
}

type OffersPanelProps = {
  offers: Offer[]
  restaurantId: string
  hasSubscription: boolean
}

export function OffersPanel({ offers, restaurantId, hasSubscription }: OffersPanelProps) {
  const [showPaywall, setShowPaywall] = useState(false)
  const visibleOffers = offers.slice(0, 3)
  const hiddenOffersCount = Math.max(offers.length - visibleOffers.length, 0)

  const handleActivateClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!hasSubscription) {
        e.preventDefault()
        setShowPaywall(true)
      }
    },
    [hasSubscription],
  )

  const handleClosePaywall = useCallback(() => setShowPaywall(false), [])

  return (
    <>
      {showPaywall ? <PaywallModal onClose={handleClosePaywall} /> : null}

      <div className="mt-4 space-y-4">
        {visibleOffers.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            Пока нет активных офферов
          </div>
        ) : (
          visibleOffers.map((offer) => (
            <div key={offer.id} className="rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold">
                {formatOfferHeadline(offer.offer_type, offer.offer_title)}
              </h3>
              {formatEstimatedValue(offer.estimated_value) ? (
                <p className="mt-1 text-sm text-gray-500">{formatEstimatedValue(offer.estimated_value)}</p>
              ) : null}
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {offer.offer_terms_short}
              </p>

              {offer.offer_terms_full ? (
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {offer.offer_terms_full}
                </p>
              ) : null}

              <div className="mt-3 space-y-0.5 text-xs text-gray-400">
                <p>{formatOfferCooldownText(offer.cooldown_days)}</p>
                {offer.requires_main_course ? <p>Требуется основное блюдо</p> : null}
              </div>

              {hasSubscription ? (
                <Button
                  href={`/app/redeem/${restaurantId}/${offer.id}`}
                  size="md"
                  className="mt-4 w-full"
                >
                  Получить
                </Button>
              ) : (
                <a
                  href={`/app/redeem/${restaurantId}/${offer.id}`}
                  onClick={handleActivateClick}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-accent-dark active:scale-[0.98]"
                >
                  Получить
                </a>
              )}
            </div>
          ))
        )}
        {hiddenOffersCount > 0 ? (
          <p className="text-center text-xs text-gray-400">и ещё {hiddenOffersCount}</p>
        ) : null}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-5">
        {hasSubscription ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-xs font-medium text-emerald-700">
            Подписка активна
          </div>
        ) : (
          <Button href="/pricing" variant="secondary" className="w-full">
            Оформить подписку
          </Button>
        )}
      </div>
    </>
  )
}
