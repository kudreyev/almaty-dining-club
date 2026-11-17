import { cache } from 'react'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
  DEFAULT_TZ,
  computeOpenStatus,
  type RestaurantHour,
} from '@/lib/opening-hours'
import {
  filterCatalogActiveOffers,
  getTodayDateStringInTz,
  pickClubOffers,
  pickSetOffers,
} from '@/lib/offers'
import {
  formatSetPrice,
  getSetServingStatus,
  isEventActiveNow,
  resolveSetSchedule,
  type EventVenueScheduleRow,
  type FestivalEvent,
} from '@/lib/events'
import type { City } from '@/lib/cities'
import type { ActiveSetBadge, Offer, RestaurantWithStatus } from '@/lib/types'
import { canViewFestivals, isFestivalPreviewVenueSlug } from '@/lib/festival-access'

type SupabaseRow = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  brand: string | null
  combine_set_with_club_offer?: boolean
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
  activeEvent: FestivalEvent | null
}

/**
 * Загружает каталог активных ресторанов-партнёров клуба заданного города.
 * Заведения только с сетами фестиваля в основной каталог не входят.
 */
export const loadHomeRestaurants = cache(loadHomeRestaurantsUncached)

async function loadHomeRestaurantsUncached(city: City): Promise<HomeRestaurantsResult> {
  const supabase = createSupabasePublicClient()
  const now = new Date()
  const today = getTodayDateStringInTz(now, DEFAULT_TZ)
  const showFestivals = await canViewFestivals()

  const restaurantsQuery = supabase
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
      combine_set_with_club_offer,
      offers (
        offer_type,
        offer_title,
        offer_terms_short,
        estimated_value,
        dish_photo_url,
        end_date,
        is_active,
        event_id,
        price_kzt
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

  const eventsQuery = showFestivals
    ? supabase
        .from('events')
        .select(
          'id, slug, name, city, starts_at, ends_at, set_price_kzt, logo_url, accent_color, is_published, max_sets_per_venue_per_day',
        )
        .eq('city', city)
        .eq('is_published', true)
        .lte('starts_at', today)
        .gte('ends_at', today)
        .order('starts_at', { ascending: false })
        .limit(1)
        .returns<FestivalEvent[]>()
    : Promise.resolve({ data: [] as FestivalEvent[] })

  const [{ data: restaurants }, { data: events }] = await Promise.all([
    restaurantsQuery,
    eventsQuery,
  ])

  const activeEvent = showFestivals
    ? ((events ?? []).find((event) => isEventActiveNow(event, now, DEFAULT_TZ)) ?? null)
    : null

  const safeRestaurants: SupabaseRow[] = (restaurants ?? [])
    .map((r) => ({
      ...r,
      offers: filterCatalogActiveOffers(r.offers ?? [], today),
      restaurant_hours: r.restaurant_hours ?? [],
    }))
    // Партнёр клуба = есть активный клубный оффер (не только сет).
    .filter((r) => pickClubOffers(r.offers).length > 0)
    // Сид TestFest не показываем гостям в основном каталоге.
    .filter((r) => showFestivals || !isFestivalPreviewVenueSlug(r.slug))

  const scheduleByRestaurant = new Map<string, EventVenueScheduleRow[]>()
  if (activeEvent && safeRestaurants.length > 0) {
    const restaurantIds = safeRestaurants.map((item) => item.id)
    const { data: scheduleRows } = await supabase
      .from('event_venue_schedule')
      .select('restaurant_id, offer_id, weekday, open_time, close_time')
      .eq('event_id', activeEvent.id)
      .in('restaurant_id', restaurantIds)
      .returns<
        Array<{
          restaurant_id: string
          offer_id: string | null
          weekday: number
          open_time: string
          close_time: string
        }>
      >()

    for (const row of scheduleRows ?? []) {
      const list = scheduleByRestaurant.get(row.restaurant_id) ?? []
      list.push({
        weekday: row.weekday,
        open_time: row.open_time,
        close_time: row.close_time,
        offer_id: row.offer_id,
      })
      scheduleByRestaurant.set(row.restaurant_id, list)
    }
  }

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

  const restaurantsWithStatus: RestaurantWithStatus[] = safeRestaurants.map((restaurant) => {
    const setOffers = activeEvent
      ? pickSetOffers(restaurant.offers).filter((o) => o.event_id === activeEvent.id)
      : []
    let activeSetBadge: ActiveSetBadge | null = null
    if (activeEvent && setOffers.length > 0) {
      const setOffer = setOffers[0]
      const schedule = resolveSetSchedule(
        scheduleByRestaurant.get(restaurant.id) ?? [],
        null,
      )
      const status = getSetServingStatus(schedule, now, DEFAULT_TZ)
      const price = setOffer.price_kzt ?? activeEvent.set_price_kzt
      activeSetBadge = {
        eventName: activeEvent.name,
        eventSlug: activeEvent.slug,
        accentColor: activeEvent.accent_color,
        priceKzt: price,
        statusLabel: status.badgeLabel,
        isServing: status.isServing,
      }
    }

    return {
      ...restaurant,
      cover_photo_url: photoByRestaurantId.get(restaurant.id) ?? null,
      openStatus: computeOpenStatus(restaurant.restaurant_hours ?? [], now, DEFAULT_TZ),
      activeSetBadge,
      // В карточке каталога показываем клубные офферы; бейдж сета отдельно.
      offers: pickClubOffers(restaurant.offers),
    }
  })

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

  return { restaurantsWithStatus, cuisineOptions, activeEvent }
}

export function formatActiveEventBanner(event: FestivalEvent): string {
  const ends = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(
    (() => {
      const [y, m, d] = event.ends_at.split('-').map(Number)
      return new Date(y, m - 1, d)
    })(),
  )
  return `${event.name} · сеты ${formatSetPrice(event.set_price_kzt)} · до ${ends}`
}
