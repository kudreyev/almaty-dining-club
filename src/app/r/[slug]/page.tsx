import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/safe-errors'
import { getGuestAccess } from '@/lib/guest-access'
import {
  filterCatalogActiveOffers,
  getTodayDateStringInTz,
  pickTopOffers,
  formatOfferUsableHoursStatus,
  getOfferUsableHours,
  type OfferType,
  type OfferUsableHour,
} from '@/lib/offers'
import { DEFAULT_TZ } from '@/lib/opening-hours'
import { CITY_LABELS, DEFAULT_CITY, isCity } from '@/lib/cities'
import { pageMetadata, restaurantDescription, restaurantTitle } from '@/lib/seo'
import { RestaurantNavBar } from '@/components/restaurant/restaurant-nav-bar'
import { RestaurantHeroGallery } from '@/components/restaurant/restaurant-hero-gallery'
import { RestaurantHero } from '@/components/restaurant/restaurant-hero'
import { RestaurantOffersList } from '@/components/restaurant/restaurant-offers-list'
import { RestaurantHowToUse } from '@/components/restaurant/restaurant-how-to-use'
import { RestaurantSignupBanner } from '@/components/restaurant/restaurant-signup-banner'
import { MetaPixelViewContent } from '@/components/analytics/meta-pixel-view-content'
import { RestaurantAddressContacts } from '@/components/restaurant/restaurant-address-contacts'
import type { RestaurantHour } from '@/lib/opening-hours'

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  city: string
  address: string
  phone: string | null
  whatsapp_phone: string | null
  instagram_url: string | null
  website_url: string | null
  two_gis_url: string | null
  external_rating: number | null
  external_reviews_count: number | null
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  tags: string[] | null
  is_active: boolean
  restaurant_hours?: RestaurantHour[]
}

type Offer = {
  id: string
  offer_type: OfferType
  offer_title: string
  offer_terms_short: string
  estimated_value: number | null
  dish_photo_url: string | null
  end_date: string | null
  offer_usable_hours?: OfferUsableHour[]
  takeaway_only: boolean
  is_active: boolean
}

type PrimaryLocation = {
  lat: number | null
  lng: number | null
}

type PageProps = {
  params: Promise<{ slug: string }>
}

const MAP_SECTION_ID = 'map-section'

const SELECT_RESTAURANT = `
  id, restaurant_name, slug, city, address, phone, whatsapp_phone,
  instagram_url, website_url, two_gis_url,
  external_rating, external_reviews_count,
  cuisine, cuisine_2, cuisine_3, tags,
  is_active,
  restaurant_hours ( day_of_week, is_closed, open_time, close_time, close_next_day )
`

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('restaurant_name, address, offers ( offer_type, offer_title, is_active, end_date )')
    .eq('slug', slug)
    .eq('is_active', true)
    .single<{
      restaurant_name: string
      address: string | null
      offers: Pick<Offer, 'offer_type' | 'offer_title' | 'is_active' | 'end_date'>[] | null
    }>()

  if (!restaurant) {
    return { title: 'Заведение не найдено — KudaClub' }
  }

  const today = getTodayDateStringInTz(new Date(), DEFAULT_TZ)
  const [mainOffer] = pickTopOffers(filterCatalogActiveOffers(restaurant.offers ?? [], today), 1)

  return pageMetadata({
    title: restaurantTitle(restaurant.restaurant_name, mainOffer ?? null),
    description: restaurantDescription(restaurant.restaurant_name, restaurant.address, mainOffer ?? null),
    path: `/r/${slug}`,
  })
}

export default async function RestaurantPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select(SELECT_RESTAURANT)
    .eq('slug', slug)
    .eq('is_active', true)
    .single<Restaurant>()

  if (restaurantError || !restaurant) notFound()

  const [
    offersResult,
    photosResult,
    primaryLocationResult,
    access,
  ] = await Promise.all([
    supabase
      .from('offers')
      .select(`
        id, offer_type, offer_title, offer_terms_short,
        estimated_value, dish_photo_url, end_date, takeaway_only, is_active,
        offer_usable_hours ( day_of_week, is_unavailable, from_time, to_time, to_next_day )
      `)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .returns<Offer[]>(),
    supabase
      .from('restaurant_photos')
      .select('full_url')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<{ full_url: string | null }[]>(),
    supabase
      .from('restaurant_locations')
      .select('lat, lng')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle<PrimaryLocation>(),
    getGuestAccess(),
  ])

  const now = new Date()
  const today = getTodayDateStringInTz(now, DEFAULT_TZ)
  const offers = filterCatalogActiveOffers(offersResult.data ?? [], today)
  const offersError = offersResult.error
  const primaryLocation = primaryLocationResult.data
  const isMember = access.kind === 'member'

  if (offersError) {
    logServerError('r/[slug]/offers', offersError)
    return (
      <main className="mx-auto max-w-3xl">
        <h1 className="px-5 py-10 text-2xl font-medium">{restaurant.restaurant_name}</h1>
        <p className="px-5 text-sm text-red-600">
          Не удалось загрузить предложения.
        </p>
      </main>
    )
  }

  const photoUrls = (photosResult.data ?? [])
    .map((item) => item.full_url)
    .filter((u): u is string => Boolean(u))

  const cuisines = [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3].filter(
    Boolean
  ) as string[]
  const tags = restaurant.tags ?? []
  const hoursForWeek = restaurant.restaurant_hours ?? []
  const cityName = isCity(restaurant.city)
    ? CITY_LABELS[restaurant.city]
    : CITY_LABELS[DEFAULT_CITY]
  const addressLine = restaurant.address?.trim() || `${restaurant.restaurant_name}, ${cityName}`
  const hasCoordinates =
    primaryLocation?.lat != null && primaryLocation?.lng != null
  const lat = primaryLocation?.lat ?? null
  const lng = primaryLocation?.lng ?? null

  const externalRating =
    restaurant.external_rating != null
      && restaurant.external_reviews_count != null
      && restaurant.two_gis_url
      ? {
          rating: Number(restaurant.external_rating),
          reviewsCount: restaurant.external_reviews_count,
          url: restaurant.two_gis_url,
        }
      : null

  const yandexSearchUrl = `https://yandex.kz/maps/?text=${encodeURIComponent(addressLine)}`
  const yandexMapUrl = hasCoordinates
    ? `https://yandex.kz/maps/?pt=${lng},${lat}&z=17&l=map`
    : yandexSearchUrl
  const mapHrefUrl = restaurant.two_gis_url || yandexMapUrl
  // Brand-orange pin (close to coral). Yandex поддерживает ограниченный набор цветов;
  // `or` (orange) ближе всего к нашему `#D85A30`.
  const staticMapUrl = hasCoordinates
    ? `https://static-maps.yandex.ru/1.x/?lang=ru_RU&ll=${lng},${lat}&z=17&l=map&size=650,400&pt=${lng},${lat},pm2orm`
    : null

  return (
    <>
      <MetaPixelViewContent
        restaurantName={restaurant.restaurant_name}
        restaurantSlug={restaurant.slug}
      />
      <RestaurantNavBar
        shareTitle={restaurant.restaurant_name}
        shareText={`${restaurant.restaurant_name} — 1+1 бесплатно с KudaClub`}
      />

      <main className="mx-auto max-w-3xl pb-10">
        <RestaurantHeroGallery
          photoUrls={photoUrls}
          restaurantName={restaurant.restaurant_name}
        />

        <RestaurantHero
          restaurantName={restaurant.restaurant_name}
          cuisines={cuisines}
          tags={tags}
          address={addressLine}
          restaurantHours={hoursForWeek}
          restaurantLat={lat}
          restaurantLng={lng}
          externalRating={externalRating}
          mapSectionId={MAP_SECTION_ID}
        />

        <section
          style={{
            padding: '24px 20px',
            borderTopWidth: '0.5px',
            borderTopStyle: 'solid',
            borderTopColor: '#f0f0f0',
          }}
        >
          <h2
            className="font-medium text-neutral-900"
            style={{ fontSize: '18px', marginBottom: '16px' }}
          >
            Предложения
          </h2>

          <RestaurantOffersList
            offers={offers.map((offer) => {
              const usableStatus = formatOfferUsableHoursStatus(
                getOfferUsableHours(offer),
                now,
                DEFAULT_TZ,
              )
              return {
                id: offer.id,
                offer_type: offer.offer_type,
                offer_title: offer.offer_title,
                offer_terms_short: offer.offer_terms_short,
                estimated_value: offer.estimated_value,
                dish_photo_url: offer.dish_photo_url,
                takeaway_only: offer.takeaway_only,
                usableHoursLabel: usableStatus.label,
                isOutsideUsableHours: !usableStatus.isUsable,
              }
            })}
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            restaurantName={restaurant.restaurant_name}
            isMember={isMember}
          />
        </section>

        <RestaurantHowToUse />

        {!isMember ? (
          <RestaurantSignupBanner
            restaurantName={restaurant.restaurant_name}
            restaurantSlug={restaurant.slug}
          />
        ) : null}

        <RestaurantAddressContacts
          id={MAP_SECTION_ID}
          address={addressLine}
          phone={restaurant.phone}
          twoGisUrl={restaurant.two_gis_url}
          instagramUrl={restaurant.instagram_url}
          staticMapUrl={staticMapUrl}
          mapHrefUrl={mapHrefUrl}
          hasCoordinates={hasCoordinates}
        />
      </main>
    </>
  )
}
