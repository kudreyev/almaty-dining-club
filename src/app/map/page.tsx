import Link from 'next/link'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import { formatOfferHeadline } from '@/lib/offers'
import { DEFAULT_TZ, computeOpenStatus, type RestaurantHour } from '@/lib/opening-hours'
import { YandexRestaurantsMap } from '@/components/map/yandex-restaurants-map'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type Offer = {
  offer_type: '2for1' | 'compliment'
  offer_title: string
  is_active: boolean
}

type RestaurantLocation = {
  lat: number | null
  lng: number | null
  is_active: boolean
  sort_order: number
}

type Restaurant = {
  id: string
  slug: string
  restaurant_name: string
  is_active: boolean
  offers: Offer[]
  restaurant_hours: RestaurantHour[]
  restaurant_locations: RestaurantLocation[]
}

export default async function MapPage() {
  const supabase = createSupabasePublicClient()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id,
      slug,
      restaurant_name,
      is_active,
      offers (
        offer_type,
        offer_title,
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
    .returns<Restaurant[]>()

  const now = new Date()
  const places = (restaurants ?? []).map((restaurant) => {
      const primaryLocation = (restaurant.restaurant_locations ?? [])
        .filter((location) => location.is_active)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]

      const openStatus = computeOpenStatus(restaurant.restaurant_hours ?? [], now, DEFAULT_TZ)
      const statusLine = openStatus.isOpen
        ? (openStatus.labelDetail
            ? `Открыто · ${openStatus.labelDetail.replace('Работает до ', 'до ')}`
            : 'Открыто')
        : (openStatus.labelDetail
            ? `Закрыто · ${openStatus.labelDetail.charAt(0).toLowerCase()}${openStatus.labelDetail.slice(1)}`
            : 'Закрыто')

      const offerChips = (restaurant.offers ?? [])
        .filter((offer) => offer.is_active)
        .slice(0, 2)
        .map((offer) => formatOfferHeadline(offer.offer_type, offer.offer_title))

      return {
        slug: restaurant.slug,
        name: restaurant.restaurant_name,
        lat: primaryLocation?.lat ?? null,
        lng: primaryLocation?.lng ?? null,
        offerChips,
        statusLine,
      }
    })
  
  const coordsCount = places.filter((p) => p.lat != null && p.lng != null).length
  const showDevCounts = process.env.NODE_ENV !== 'production'

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Карта заведений</h1>
          <p className="mt-1 text-sm text-gray-500">Нажмите на маркер, чтобы открыть карточку заведения.</p>
          {coordsCount === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Нет координат у заведений — добавьте lat/lng в админке, пока карта центрируется на Алматы.
            </p>
          ) : null}
          {showDevCounts ? (
            <p className="mt-1 text-xs text-gray-400">
              dev: всего заведений {places.length}, с координатами {coordsCount}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          К списку
        </Link>
      </div>

      <div className="h-[calc(100vh-10rem)] min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        <YandexRestaurantsMap places={places} />
      </div>
    </div>
  )
}
