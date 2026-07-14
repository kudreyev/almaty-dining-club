import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
  filterCatalogActiveOffers,
  formatOfferHeadline,
  getTodayDateStringInTz,
} from '@/lib/offers'
import { DEFAULT_TZ, computeOpenStatus, type RestaurantHour } from '@/lib/opening-hours'
import { CITY_LABELS, isCity } from '@/lib/cities'
import { MapScreen } from './map-screen'
import type { OfferType } from '@/lib/offers'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type Offer = {
  offer_type: OfferType
  offer_title: string
  is_active: boolean
  end_date?: string | null
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
  address: string | null
  is_active: boolean
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  offers: Offer[]
  restaurant_hours: RestaurantHour[]
  restaurant_locations: RestaurantLocation[]
}

type PageProps = {
  params: Promise<{ city: string }>
}

export default async function MapPage({ params }: PageProps) {
  const { city } = await params
  if (!isCity(city)) notFound()

  const supabase = createSupabasePublicClient()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id,
      slug,
      restaurant_name,
      address,
      is_active,
      cuisine,
      cuisine_2,
      cuisine_3,
      offers (
        offer_type,
        offer_title,
        is_active,
        end_date
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
    .returns<Restaurant[]>()

  const now = new Date()
  const today = getTodayDateStringInTz(now, DEFAULT_TZ)
  const places = (restaurants ?? [])
    .map((restaurant) => {
      const activeOffers = filterCatalogActiveOffers(restaurant.offers ?? [], today)
      if (activeOffers.length === 0) return null

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

      const offerChips = activeOffers
        .slice(0, 3)
        .map((offer) => formatOfferHeadline(offer.offer_type, offer.offer_title))

      const activeOffersCount = activeOffers.length

      const offerTypes = Array.from(
        new Set(activeOffers.map((o) => o.offer_type))
      )

      const cuisines = [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
        .map((x) => (x ?? '').trim())
        .filter(Boolean)

      return {
        slug: restaurant.slug,
        name: restaurant.restaurant_name,
        address: (restaurant.address ?? '').trim(),
        lat: primaryLocation?.lat ?? null,
        lng: primaryLocation?.lng ?? null,
        offerChips,
        extraOffersCount: Math.max(activeOffersCount - 3, 0),
        offerTypes,
        cuisines,
        isOpen: openStatus.isOpen,
        statusLine,
      }
    })
    .filter((place): place is NonNullable<typeof place> => place !== null)

  const allCuisineOptions = Array.from(
    new Set(places.flatMap((p) => p.cuisines).map((x) => x.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'ru'))

  return (
    <div className="mx-auto flex max-w-6xl flex-col sm:px-5 sm:py-6">
      {/* Desktop header */}
      <div className="hidden sm:mb-4 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Карта заведений · {CITY_LABELS[city]}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Нажмите на маркер, чтобы открыть карточку заведения.</p>
        </div>
        <Link
          href={`/${city}`}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          К списку
        </Link>
      </div>

      {/* Mobile-first full-screen map below site header (h-14) */}
      <div className="h-[calc(100dvh-3.5rem)] min-h-[420px] overflow-hidden sm:h-[calc(100dvh-10rem)] sm:rounded-2xl sm:border sm:border-gray-200 sm:bg-gray-50">
        <MapScreen places={places} allCuisineOptions={allCuisineOptions} listHref={`/${city}`} />
      </div>
    </div>
  )
}
