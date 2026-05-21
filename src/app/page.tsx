import { createSupabasePublicClient } from '@/lib/supabase/public'
import { VenuesSection } from '@/components/home/venues-section'
import { HomeMobileControls } from '@/components/home/home-mobile-controls'
import { HeroGuest } from '@/components/home/hero-guest'
import { HeroSubscriber } from '@/components/home/hero-subscriber'
import { HowItWorks } from '@/components/home/how-it-works'
import { EconomicsSection } from '@/components/home/economics-section'
import { FinalCta } from '@/components/sections/final-cta'
import { getHomePageUserState, getUserSavings } from '@/lib/subscription'
import {
  DEFAULT_TZ,
  computeOpenStatus,
  type RestaurantHour,
} from '@/lib/opening-hours'
import { pluralizeRu } from '@/lib/ru-plural'
import type { Offer, RestaurantWithStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

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

async function loadHomeRestaurants() {
  const supabase = createSupabasePublicClient()
  const now = new Date()

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
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })
    .returns<SupabaseRow[]>()

  const safeRestaurants: SupabaseRow[] = (restaurants ?? []).map((r) => ({
    ...r,
    offers: (r.offers ?? []).filter((o) => o.is_active),
    restaurant_hours: r.restaurant_hours ?? [],
  }))

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

export default async function HomePage() {
  const [userState, restaurantsData] = await Promise.all([
    getHomePageUserState(),
    loadHomeRestaurants(),
  ])

  const { restaurantsWithStatus, cuisineOptions } = restaurantsData
  const totalVenues = restaurantsWithStatus.length
  const venuesWord = pluralizeRu(totalVenues, [
    'заведение',
    'заведения',
    'заведений',
  ])
  const venuesSectionTitle =
    totalVenues > 0 ? `${totalVenues} ${venuesWord} Алматы` : 'Заведения Алматы'

  const isSubscriber = userState.kind === 'paid' || userState.kind === 'trial'

  if (isSubscriber) {
    const savings = await getUserSavings(userState.user.id)

    return (
      <>
        <HeroSubscriber
          planType={userState.kind === 'trial' ? 'trial' : 'paid'}
          endDate={userState.endDate}
          daysLeft={userState.kind === 'trial' ? userState.daysLeft : undefined}
          savingsAmountKzt={savings.amountKzt}
          hasRedemptions={savings.hasRedemptions}
        />

        <div id="venues" className="mx-auto max-w-6xl px-5 pb-12 pt-2 md:pb-16">
          <VenuesSection
            restaurants={restaurantsWithStatus}
            cuisineOptions={cuisineOptions}
            title={venuesSectionTitle}
          />

          <HomeMobileControls
            cuisineOptions={cuisineOptions}
            applyCount={restaurantsWithStatus.length}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <HeroGuest venuesCount={totalVenues} />

      <HowItWorks venuesCount={totalVenues} />

      <div
        id="venues"
        className="mx-auto max-w-6xl px-5 py-8 md:py-12"
      >
        <VenuesSection
          restaurants={restaurantsWithStatus}
          cuisineOptions={cuisineOptions}
          title={venuesSectionTitle}
        />

        <HomeMobileControls
          cuisineOptions={cuisineOptions}
          applyCount={restaurantsWithStatus.length}
        />
      </div>

      <EconomicsSection />

      <FinalCta />
    </>
  )
}
