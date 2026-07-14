import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
  DEFAULT_TZ,
  computeOpenStatus,
  type RestaurantHour,
} from '@/lib/opening-hours'
import {
  filterCatalogActiveOffers,
  getTodayDateStringInTz,
} from '@/lib/offers'
import type { City } from '@/lib/cities'
import type { Offer, RestaurantWithStatus } from '@/lib/types'

type SupabaseRow = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  brand: string | null
  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
  restaurant_locations?: {
    lat: number | null
    lng: number | null
    is_active: boolean
    sort_order: number
  }[]
}

export type HomeRestaurantsResult = {
  restaurantsWithStatus: RestaurantWithStatus[]
  cuisineOptions: string[]
}

/**
 * Загружает каталог активных ресторанов заданного города с фото, часами,
 * оффером и предвычисленным openStatus. Используется в каталоге (/[city]) и
 * в кабинете для бывших/неактивных подписчиков (/app/me) — экран реактивации.
 */
export async function loadHomeRestaurants(city: City): Promise<HomeRestaurantsResult> {
  const supabase = createSupabasePublicClient()
  const now = new Date()
  const today = getTodayDateStringInTz(now, DEFAULT_TZ)

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id,
      restaurant_name,
      slug,
      address,
      cuisine,
      cuisine_2,
      cuisine_3,
      brand,
      offers (
        offer_type,
        offer_title,
        offer_terms_short,
        estimated_value,
        cooldown_days,
        end_date,
        is_active
      ),
      restaurant_hours (
        day_of_week,
        is_closed,
        open_time,
        close_time,
        close_next_day
      ),
      restaurant_locations (
        lat,
        lng,
        is_active,
        sort_order
      )
    `)
    .eq('city', city)
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })
    .returns<SupabaseRow[]>()

  const safeRestaurants: SupabaseRow[] = (restaurants ?? [])
    .map((r) => ({
      ...r,
      offers: filterCatalogActiveOffers(r.offers ?? [], today),
      restaurant_hours: r.restaurant_hours ?? [],
    }))
    .filter((r) => r.offers.length > 0)

  const photoByRestaurantId = new Map<string, string>()
  if (safeRestaurants.length > 0) {
    const restaurantIds = safeRestaurants.map((item) => item.id)
    const { data: photos } = await supabase
      .from('restaurant_photos')
      .select('restaurant_id, thumb_url, sort_order')
      .in('restaurant_id', restaurantIds)
      .eq('is_active', true)
      .order('restaurant_id', { ascending: true })
      .order('sort_order', { ascending: true })

    for (const photo of photos ?? []) {
      if (!photoByRestaurantId.has(photo.restaurant_id)) {
        photoByRestaurantId.set(photo.restaurant_id, photo.thumb_url)
      }
    }
  }

  const restaurantsWithStatus: RestaurantWithStatus[] = safeRestaurants.map(
    (restaurant) => ({
      ...restaurant,
      cover_photo_url: photoByRestaurantId.get(restaurant.id) ?? null,
      openStatus: computeOpenStatus(
        restaurant.restaurant_hours ?? [],
        now,
        DEFAULT_TZ
      ),
    })
  )

  const cuisineFrequency = new Map<string, number>()
  for (const r of safeRestaurants) {
    for (const c of [r.cuisine, r.cuisine_2, r.cuisine_3]) {
      const trimmed = (c ?? '').trim()
      if (!trimmed) continue
      cuisineFrequency.set(trimmed, (cuisineFrequency.get(trimmed) ?? 0) + 1)
    }
  }
  const cuisineOptions = Array.from(cuisineFrequency.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0], 'ru')
    })
    .map(([name]) => name)

  return { restaurantsWithStatus, cuisineOptions }
}
