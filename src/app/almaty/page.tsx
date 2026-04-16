export const revalidate = 300
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RestaurantListClient } from '@/components/restaurant-list-client'
import { DEFAULT_TZ, computeOpenStatus, type RestaurantHour } from '@/lib/opening-hours'

type Offer = {
  id: string
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  estimated_value?: number | null
  cooldown_days?: number | null
  is_active: boolean
}

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  cover_photo_url?: string | null
  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
  restaurant_locations?: {
    lat: number | null
    lng: number | null
    is_active: boolean
    sort_order: number
  }[]
}

type PageProps = {
  searchParams: Promise<{
    q?: string
    offer?: string
    openNow?: string
  }>
}

function almatyQuery(params: Record<string, string>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== 'all') u.set(k, v)
  }
  const qs = u.toString()
  return qs ? `/almaty?${qs}` : '/almaty'
}

export default async function AlmatyPage({ searchParams }: PageProps) {
  const { q = '', offer = 'all', openNow: openNowRaw = '0' } = await searchParams
  const openNow = openNowRaw === '1'
  const supabase = await createSupabaseServerClient()
  const now = new Date()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(`
      id, restaurant_name, slug, address,
      cuisine, cuisine_2, cuisine_3,
      offers ( id, offer_type, offer_title, offer_terms_short, estimated_value, cooldown_days, is_active ),
      restaurant_hours ( day_of_week, is_closed, open_time, close_time, close_next_day ),
      restaurant_locations ( lat, lng, is_active, sort_order )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Заведения Алматы</h1>
        <p className="mt-4 text-base text-red-600">Ошибка: {error.message}</p>
      </div>
    )
  }

  const normalizedQuery = q.trim().toLowerCase()
  const safeRestaurants = (restaurants as Restaurant[]) ?? []
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

  const restaurantsWithStatus = safeRestaurants.map((restaurant) => ({
    ...restaurant,
    offers: (restaurant.offers ?? []).filter((item) => item.is_active),
    restaurant_hours: restaurant.restaurant_hours ?? [],
    cover_photo_url: photoByRestaurantId.get(restaurant.id) ?? null,
    openStatus: computeOpenStatus(restaurant.restaurant_hours ?? [], now, DEFAULT_TZ),
  }))

  const filteredRestaurants = restaurantsWithStatus.filter((restaurant) => {
    const matchesQuery =
      !normalizedQuery ||
      restaurant.restaurant_name.toLowerCase().includes(normalizedQuery) ||
      [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
        .filter(Boolean)
        .some((c) => c!.toLowerCase().includes(normalizedQuery))

    const matchesOffer =
      offer === 'all' || restaurant.offers.some((item) => item.offer_type === offer)
    const matchesOpenNow = !openNow || restaurant.openStatus.isOpen

    return matchesQuery && matchesOffer && matchesOpenNow
  })

  const quickChips = [
    {
      label: 'Открыто сейчас',
      href: almatyQuery({
        q,
        offer,
        openNow: openNow ? '' : '1',
      }),
      isActive: openNow,
    },
    {
      label: '2за1',
      href: almatyQuery({
        q,
        offer: offer === '2for1' ? '' : '2for1',
        openNow: openNow ? '1' : '',
      }),
      isActive: offer === '2for1',
    },
    {
      label: 'В подарок',
      href: almatyQuery({
        q,
        offer: offer === 'compliment' ? '' : 'compliment',
        openNow: openNow ? '1' : '',
      }),
      isActive: offer === 'compliment',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Заведения Алматы</h1>
        <p className="mt-2 text-base leading-6 text-gray-500">Партнёры с офферами 2за1 и в подарок.</p>
      </div>

      <RestaurantListClient
        restaurants={filteredRestaurants}
        quickChips={quickChips}
        title="Заведения"
        showMapLink
      />
    </div>
  )
}
