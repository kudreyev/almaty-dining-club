import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/safe-errors'
import { getGuestAccess } from '@/lib/guest-access'
import {
  filterCatalogActiveOffers,
  getTodayDateStringInTz,
  pickClubOffers,
  pickTopOffers,
  formatOfferUsableHoursStatus,
  getOfferUsableHours,
  type OfferType,
  type OfferUsableHour,
} from '@/lib/offers'
import {
  formatCompactSchedule,
  formatEventEndsLabel,
  getSetServingStatus,
  isEventActiveNow,
  parseSetItems,
  resolveSetSchedule,
  type EventVenueScheduleRow,
  type FestivalEvent,
} from '@/lib/events'
import { DEFAULT_TZ } from '@/lib/opening-hours'
import { CITY_LABELS, DEFAULT_CITY, isCity } from '@/lib/cities'
import {
  canViewFestivalPreviewVenue,
  canViewFestivals,
  isFestivalAdminOnly,
} from '@/lib/festival-access'
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
  combine_set_with_club_offer: boolean
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
  event_id: string | null
  price_kzt: number | null
  items: unknown
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
  is_active, combine_set_with_club_offer,
  restaurant_hours ( day_of_week, is_closed, open_time, close_time, close_next_day )
`

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  if (!(await canViewFestivalPreviewVenue(slug))) {
    return { title: 'Заведение не найдено — KudaClub' }
  }
  const supabase = await createSupabaseServerClient()
  const allowInactivePreview =
    isFestivalAdminOnly() && (await canViewFestivals()) && slug.startsWith('testfest-')

  let metaQuery = supabase
    .from('restaurants')
    .select('restaurant_name, address, offers ( offer_type, offer_title, is_active, end_date )')
    .eq('slug', slug)
  if (!allowInactivePreview) {
    metaQuery = metaQuery.eq('is_active', true)
  }

  const { data: restaurant } = await metaQuery.single<{
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
  if (!(await canViewFestivalPreviewVenue(slug))) notFound()

  const supabase = await createSupabaseServerClient()
  const allowInactivePreview =
    isFestivalAdminOnly() && (await canViewFestivals()) && slug.startsWith('testfest-')

  let restaurantQuery = supabase
    .from('restaurants')
    .select(SELECT_RESTAURANT)
    .eq('slug', slug)

  if (!allowInactivePreview) {
    restaurantQuery = restaurantQuery.eq('is_active', true)
  }

  const { data: restaurant, error: restaurantError } = await restaurantQuery.single<Restaurant>()

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
        event_id, price_kzt, items,
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

  const clubOffers = pickClubOffers(offers)
  const showFestivals = await canViewFestivals()
  const setOffers = showFestivals
    ? offers.filter((o) => o.offer_type === 'set' && o.event_id)
    : []
  const eventIds = [...new Set(setOffers.map((o) => o.event_id!).filter(Boolean))]

  let events: FestivalEvent[] = []
  let scheduleRows: Array<EventVenueScheduleRow & { event_id: string }> = []
  if (eventIds.length > 0) {
    const [{ data: eventRows }, { data: sched }] = await Promise.all([
      supabase
        .from('events')
        .select(
          'id, slug, name, city, starts_at, ends_at, set_price_kzt, logo_url, accent_color, is_published',
        )
        .in('id', eventIds)
        .returns<FestivalEvent[]>(),
      supabase
        .from('event_venue_schedule')
        .select('event_id, offer_id, weekday, open_time, close_time')
        .eq('restaurant_id', restaurant.id)
        .in('event_id', eventIds)
        .returns<
          Array<{
            event_id: string
            offer_id: string | null
            weekday: number
            open_time: string
            close_time: string
          }>
        >(),
    ])
    events = (eventRows ?? []).filter((e) => isEventActiveNow(e, now, DEFAULT_TZ))
    scheduleRows = (sched ?? []).map((row) => ({
      event_id: row.event_id,
      offer_id: row.offer_id,
      weekday: row.weekday,
      open_time: row.open_time,
      close_time: row.close_time,
    }))
  }

  const activeEventIds = new Set(events.map((e) => e.id))
  const festivalBlocks = events.map((event) => {
    const eventSets = setOffers.filter((o) => o.event_id === event.id)
    const venueSchedule = scheduleRows.filter((r) => r.event_id === event.id)
    return {
      eventName: event.name,
      endsLabel: formatEventEndsLabel(event.ends_at),
      accentColor: event.accent_color,
      offers: eventSets.map((offer) => {
        const schedule = resolveSetSchedule(venueSchedule, offer.id)
        const status = getSetServingStatus(schedule, now, DEFAULT_TZ)
        return {
          id: offer.id,
          offer_type: offer.offer_type,
          offer_title: offer.offer_title,
          offer_terms_short: offer.offer_terms_short,
          estimated_value: offer.estimated_value,
          dish_photo_url: offer.dish_photo_url,
          takeaway_only: offer.takeaway_only,
          usableHoursLabel: status.badgeLabel,
          isOutsideUsableHours: !status.isServing,
          price_kzt: offer.price_kzt ?? event.set_price_kzt,
          items: parseSetItems(offer.items),
          event_slug: event.slug,
          event_name: event.name,
          accent_color: event.accent_color,
          schedule_summary: formatCompactSchedule(schedule) || null,
          ctaDisabledLabel: status.isServing ? null : status.ctaLabel,
        }
      }),
    }
  })

  // Drop sets whose event is not active (ended / unpublished).
  void activeEventIds

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
          {showFestivals && isFestivalAdminOnly() && festivalBlocks.some((b) => b.offers.length > 0) ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Превью фестиваля — блоки сетов видят только админы.
            </p>
          ) : null}
          <RestaurantOffersList
            clubOffers={clubOffers.map((offer) => {
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
            festivalBlocks={festivalBlocks}
            combineAllowed={restaurant.combine_set_with_club_offer}
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
