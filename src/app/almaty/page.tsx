export const revalidate = 300
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/safe-errors'
import { VenuesSection } from '@/components/home/venues-section'
import { DEFAULT_TZ, computeOpenStatus, type RestaurantHour } from '@/lib/opening-hours'
import type { Offer, RestaurantWithStatus } from '@/lib/types'

type SupabaseRow = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
  restaurant_locations?: {
    lat: number | null
    lng: number | null
    is_active: boolean
    sort_order: number
  }[]
}

export default async function AlmatyPage() {
  const supabase = await createSupabaseServerClient()
  const now = new Date()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(`
      id, restaurant_name, slug, address,
      cuisine, cuisine_2, cuisine_3,
      offers ( offer_type, offer_title, offer_terms_short, estimated_value, cooldown_days, is_active ),
      restaurant_hours ( day_of_week, is_closed, open_time, close_time, close_next_day ),
      restaurant_locations ( lat, lng, is_active, sort_order )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })

  if (error) {
    logServerError('almaty/restaurants', error)
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Заведения Алматы</h1>
        <p className="mt-4 text-base text-red-600">Не удалось загрузить список заведений.</p>
      </div>
    )
  }

  const safeRestaurants = (restaurants as SupabaseRow[]) ?? []
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

  const restaurantsWithStatus: RestaurantWithStatus[] = safeRestaurants.map((restaurant) => ({
    ...restaurant,
    offers: (restaurant.offers ?? []).filter((item) => item.is_active),
    restaurant_hours: restaurant.restaurant_hours ?? [],
    cover_photo_url: photoByRestaurantId.get(restaurant.id) ?? null,
    openStatus: computeOpenStatus(restaurant.restaurant_hours ?? [], now, DEFAULT_TZ),
  }))

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

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <VenuesSection
        restaurants={restaurantsWithStatus}
        cuisineOptions={cuisineOptions}
      />
    </div>
  )
}
