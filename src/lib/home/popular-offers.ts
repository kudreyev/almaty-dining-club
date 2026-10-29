import type { OfferType } from '@/lib/offers'
import type { Restaurant } from '@/lib/types'

export type PopularOffer = {
  restaurantSlug: string
  restaurantName: string
  offerType: OfferType
  offerTitle: string
  estimatedValue: number | null
  photoUrl: string | null
}

const TYPE_RANK: Record<OfferType, number> = {
  '2for1': 0,
  kudafest_set: 1,
  compliment: 2,
}

function value(offer: { estimated_value?: number | null }): number {
  const v = offer.estimated_value
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

function compareStrength(
  a: { offer_type: OfferType; estimated_value?: number | null },
  b: { offer_type: OfferType; estimated_value?: number | null },
): number {
  const byType = TYPE_RANK[a.offer_type] - TYPE_RANK[b.offer_type]
  if (byType !== 0) return byType
  return value(b) - value(a)
}

/**
 * Самые сильные предложения: сначала 1+1, внутри — по выгоде (стейк выше кофе).
 * По одному лучшему офферу на заведение, чтобы витрина была разнообразной.
 */
export function pickPopularOffers(
  restaurants: Pick<Restaurant, 'slug' | 'restaurant_name' | 'cover_photo_url' | 'offers'>[],
  limit = 6,
): PopularOffer[] {
  const best = restaurants
    .map((restaurant) => {
      const offer = restaurant.offers
        .filter((o) => o.is_active)
        .sort(compareStrength)[0]
      return offer ? { restaurant, offer } : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  best.sort((a, b) => compareStrength(a.offer, b.offer))

  return best.slice(0, limit).map(({ restaurant, offer }) => ({
    restaurantSlug: restaurant.slug,
    restaurantName: restaurant.restaurant_name,
    offerType: offer.offer_type,
    offerTitle: offer.offer_title,
    estimatedValue: value(offer) || null,
    photoUrl: offer.dish_photo_url ?? restaurant.cover_photo_url ?? null,
  }))
}
