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
  estimated_value?: number | null
  cooldown_days?: number | null
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

      <div className="flex flex-col gap-4">
        {visibleOffers.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-base text-gray-400">
            Пока нет активных офферов
          </div>
        ) : (
          visibleOffers.map((offer) => {
            const benefitLabel = formatEstimatedValue(offer.estimated_value)
            const cooldownLabel = formatOfferCooldownText(offer.cooldown_days)
            return (
            <div key={offer.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <h3 className="text-lg font-semibold leading-6 text-gray-900 sm:text-xl">
                {formatOfferHeadline(offer.offer_type, offer.offer_title)}
              </h3>

              <div className="mt-2 flex min-w-0 flex-nowrap items-center gap-1 sm:gap-2">
                {benefitLabel ? (
                  <span
                    className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 sm:px-3 sm:text-sm"
                    title={benefitLabel}
                  >
                    {benefitLabel}
                  </span>
                ) : null}
                <span
                  className={`inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 sm:px-3 sm:text-sm ${
                    benefitLabel ? 'min-w-0 flex-1' : 'shrink-0'
                  }`}
                  title={cooldownLabel}
                >
                  <span className={benefitLabel ? 'block truncate' : 'block'}>
                    {cooldownLabel}
                  </span>
                </span>
              </div>

              <p className="mt-3 text-base leading-6 text-gray-600">
                {offer.offer_terms_short}
              </p>

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
            )
          })
        )}
        {hiddenOffersCount > 0 ? (
          <p className="text-center text-sm text-gray-400">и ещё {hiddenOffersCount}</p>
        ) : null}
      </div>

      {hasSubscription ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
          Подписка активна
        </div>
      ) : null}
    </>
  )
}
