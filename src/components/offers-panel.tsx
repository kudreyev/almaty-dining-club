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

  const hasOffers = visibleOffers.length > 0

  return (
    <>
      {showPaywall ? <PaywallModal onClose={handleClosePaywall} /> : null}

      <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-950 to-gray-900 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_12px_32px_-8px_rgba(0,0,0,0.16)] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Предложения</h2>
          {hasOffers ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/80">
              {offers.length} {offers.length === 1 ? 'оффер' : offers.length < 5 ? 'оффера' : 'офферов'}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          {!hasOffers ? (
            <div className="rounded-xl bg-white/10 px-4 py-6 text-center text-base text-white/50">
              Пока нет активных офферов
            </div>
          ) : (
            visibleOffers.map((offer) => {
              const benefitLabel = formatEstimatedValue(offer.estimated_value)
              const cooldownLabel = formatOfferCooldownText(offer.cooldown_days)
              return (
                <div
                  key={offer.id}
                  className="rounded-2xl border border-white/10 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_16px_-4px_rgba(0,0,0,0.1)]"
                >
                  <h3 className="text-lg font-bold leading-6 text-gray-950 sm:text-xl">
                    {formatOfferHeadline(offer.offer_type, offer.offer_title)}
                  </h3>

                  <div className="mt-2.5 flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
                    {benefitLabel ? (
                      <span
                        className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-gray-950 px-2.5 py-1 text-xs font-semibold text-white sm:px-3 sm:text-sm"
                        title={benefitLabel}
                      >
                        {benefitLabel}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 sm:px-3 sm:text-sm ${
                        benefitLabel ? 'min-w-0 flex-1' : 'shrink-0'
                      }`}
                      title={cooldownLabel}
                    >
                      <span className={benefitLabel ? 'block truncate' : 'block'}>
                        {cooldownLabel}
                      </span>
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
                    {offer.offer_terms_short}
                  </p>

                  {hasSubscription ? (
                    <Button
                      href={`/app/redeem/${restaurantId}/${offer.id}`}
                      size="md"
                      className="mt-5 w-full"
                    >
                      Получить
                    </Button>
                  ) : (
                    <a
                      href={`/app/redeem/${restaurantId}/${offer.id}`}
                      onClick={handleActivateClick}
                      className="mt-5 flex w-full items-center justify-center rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-black active:scale-[0.98]"
                    >
                      Получить
                    </a>
                  )}
                </div>
              )
            })
          )}
          {hiddenOffersCount > 0 ? (
            <p className="text-center text-sm text-white/50">и ещё {hiddenOffersCount}</p>
          ) : null}
        </div>

        {hasSubscription ? (
          <div className="mt-4 rounded-xl bg-emerald-400/15 px-4 py-3 text-center text-sm font-medium text-emerald-300">
            Подписка активна
          </div>
        ) : null}
      </div>
    </>
  )
}
