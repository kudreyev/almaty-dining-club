import type { OpenStatus, RestaurantHour } from '@/lib/opening-hours'
import type { OfferType } from '@/lib/offers'

export type { OfferType }

export type Offer = {
  offer_type: OfferType
  offer_title: string
  offer_terms_short?: string
  estimated_value?: number | null
  cooldown_days?: number | null
  end_date?: string | null
  is_active: boolean
}

export type RestaurantLocation = {
  lat: number | null
  lng: number | null
  is_active: boolean
  sort_order: number
}

export type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  brand?: string | null
  cover_photo_url?: string | null
  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
  restaurant_locations?: RestaurantLocation[]
}

export type RestaurantWithStatus = Restaurant & {
  openStatus: OpenStatus
}

export type FilterState = {
  openNow: boolean
  nearby: boolean
  offers: Set<OfferType>
  cuisines: Set<string>
}

export const EMPTY_FILTER_STATE: FilterState = {
  openNow: false,
  nearby: false,
  offers: new Set<OfferType>(),
  cuisines: new Set<string>(),
}

export function hasAnyActiveFilter(filters: FilterState): boolean {
  return (
    filters.openNow
    || filters.nearby
    || filters.offers.size > 0
    || filters.cuisines.size > 0
  )
}

export type CardStatus = {
  isOpen: boolean
  label: 'Открыто' | 'Закрыто'
  detail: string | null
}
