'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { PaywallModal } from '@/components/paywall-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Offer = {
  id: string
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  offer_terms_full: string
  offer_days: string
  offer_time_from: string
  offer_time_to: string
  requires_main_course: boolean
  is_stackable_with_other_promos: boolean
}

type OffersPanelProps = {
  offers: Offer[]
  restaurantId: string
  hasSubscription: boolean
}

export function OffersPanel({ offers, restaurantId, hasSubscription }: OffersPanelProps) {
  const [showPaywall, setShowPaywall] = useState(false)

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
        {offers.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            Пока нет активных офферов
          </div>
        ) : (
          offers.map((offer) => (
            <div key={offer.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge color="dark">
                  {offer.offer_type === '2for1' ? '1+1' : 'Комплимент'}
                </Badge>
                <span className="text-xs text-gray-400">
                  {offer.offer_time_from.slice(0, 5)}–{offer.offer_time_to.slice(0, 5)}
                </span>
              </div>

              <h3 className="mt-3 text-sm font-semibold">{offer.offer_title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {offer.offer_terms_short}
              </p>

              {offer.offer_terms_full ? (
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {offer.offer_terms_full}
                </p>
              ) : null}

              <div className="mt-3 space-y-0.5 text-xs text-gray-400">
                <p>Дни: {offer.offer_days}</p>
                {offer.requires_main_course ? <p>Требуется основное блюдо</p> : null}
                {!offer.is_stackable_with_other_promos ? (
                  <p>Не суммируется с другими акциями</p>
                ) : null}
              </div>

              {hasSubscription ? (
                <Button
                  href={`/app/redeem/${restaurantId}/${offer.id}`}
                  size="md"
                  className="mt-4 w-full"
                >
                  Активировать
                </Button>
              ) : (
                <a
                  href={`/app/redeem/${restaurantId}/${offer.id}`}
                  onClick={handleActivateClick}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-accent-dark active:scale-[0.98]"
                >
                  Активировать
                </a>
              )}
            </div>
          ))
        )}
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
