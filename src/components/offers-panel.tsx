'use client'

import { useCallback, useState } from 'react'
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
            <div
              key={offer.id}
              className="rounded-xl border border-white/20 bg-[#DA5F3D] p-4"
            >
              <span
                className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-medium text-white ${
                  offer.offer_type === 'compliment'
                    ? 'bg-[#DA5F3D] ring-1 ring-inset ring-white/50'
                    : 'bg-black'
                }`}
              >
                <span className="truncate">
                  {formatOfferHeadline(offer.offer_type, offer.offer_title)}
                </span>
              </span>

              {formatEstimatedValue(offer.estimated_value) ? (
                <p className="mt-2 text-sm text-white/90">{formatEstimatedValue(offer.estimated_value)}</p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {offer.offer_terms_short}
              </p>

              {offer.offer_terms_full ? (
                <p className="mt-2 text-xs leading-relaxed text-white/80">
                  {offer.offer_terms_full}
                </p>
              ) : null}

              <div className="mt-3 space-y-0.5 border-t border-white/20 pt-3 text-xs text-white/80">
                <p>{formatOfferCooldownText(offer.cooldown_days)}</p>
                {offer.requires_main_course ? <p>Требуется основное блюдо</p> : null}
              </div>

              {hasSubscription ? (
                <Button
                  href={`/app/redeem/${restaurantId}/${offer.id}`}
                  size="md"
                  className="mt-4 w-full rounded-2xl border-0 !bg-white !text-black hover:!bg-white/90 focus-visible:ring-white/40"
                >
                  Получить
                </Button>
              ) : (
                <a
                  href={`/app/redeem/${restaurantId}/${offer.id}`}
                  onClick={handleActivateClick}
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black transition-all duration-150 hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#DA5F3D]"
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
