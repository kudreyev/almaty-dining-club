import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/safe-errors'
import {
  getCurrentUserSubscription,
  isSubscriptionCurrentlyActive,
} from '@/lib/subscription'
import {
  resolveOfferCooldownDays,
  filterCatalogActiveOffers,
  getTodayDateStringInTz,
  formatOfferUsableHoursStatus,
  getOfferUsableHours,
  type OfferType,
  type OfferUsableHour,
} from '@/lib/offers'
import { DEFAULT_TZ } from '@/lib/opening-hours'
import { RestaurantNavBar } from '@/components/restaurant/restaurant-nav-bar'
import { RestaurantHeroGallery } from '@/components/restaurant/restaurant-hero-gallery'
import { RestaurantHero } from '@/components/restaurant/restaurant-hero'
import { RestaurantOffersList } from '@/components/restaurant/restaurant-offers-list'
import { RestaurantHowToUse } from '@/components/restaurant/restaurant-how-to-use'
import { RestaurantSubscribeBanner } from '@/components/restaurant/restaurant-subscribe-banner'
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
  cooldown_days: number | null
  dish_photo_url: string | null
  end_date: string | null
  offer_usable_hours?: OfferUsableHour[]
  is_active: boolean
}

type PrimaryLocation = {
  lat: number | null
  lng: number | null
}

type RedemptionRow = {
  offer_id: string
  redeemed_at: string
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

async function loadCooldownDaysLeft(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  offers: Pick<Offer, 'id' | 'cooldown_days'>[]
): Promise<Record<string, number>> {
  const offerIds = offers.map((o) => o.id)
  const maxCooldownDays = offers.reduce(
    (acc, o) => Math.max(acc, resolveOfferCooldownDays(o.cooldown_days)),
    0
  )
  if (maxCooldownDays <= 0) return {}

  const earliest = new Date()
  earliest.setDate(earliest.getDate() - maxCooldownDays)

  const { data: redemptions } = await supabase
    .from('redemptions')
    .select('offer_id, redeemed_at')
    .eq('user_id', userId)
    .in('offer_id', offerIds)
    .gte('redeemed_at', earliest.toISOString())
    .order('redeemed_at', { ascending: false })
    .returns<RedemptionRow[]>()

  const lastByOffer = new Map<string, string>()
  for (const row of redemptions ?? []) {
    if (!lastByOffer.has(row.offer_id)) {
      lastByOffer.set(row.offer_id, row.redeemed_at)
    }
  }

  const result: Record<string, number> = {}
  const nowTs = new Date().getTime()
  for (const offer of offers) {
    const lastRedeemedAt = lastByOffer.get(offer.id)
    if (!lastRedeemedAt) continue
    const cooldownDays = resolveOfferCooldownDays(offer.cooldown_days)
    const lastTs = new Date(lastRedeemedAt).getTime()
    const elapsedDays = (nowTs - lastTs) / (1000 * 60 * 60 * 24)
    const remaining = cooldownDays - elapsedDays
    if (remaining > 0) {
      result[offer.id] = Math.max(1, Math.ceil(remaining))
    }
  }
  return result
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('restaurant_name, address, cuisine, cuisine_2, cuisine_3')
    .eq('slug', slug)
    .eq('is_active', true)
    .single<{
      restaurant_name: string
      address: string
      cuisine: string
      cuisine_2: string | null
      cuisine_3: string | null
    }>()

  if (!restaurant) {
    return { title: 'Заведение не найдено — Kudaclub' }
  }

  const cuisines = [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
    .filter(Boolean)
    .join(', ')

  const title = `${restaurant.restaurant_name} в Алматы — офферы Kudaclub`
  const descriptionParts = [
    `${restaurant.restaurant_name} — 2 за 1 и подарки по подписке Kudaclub`,
    cuisines ? `Кухня: ${cuisines}.` : null,
    restaurant.address ? `Адрес: ${restaurant.address}.` : null,
    'Подписка 1 990 ₸/мес — окупается первым визитом.',
  ].filter(Boolean) as string[]
  const description = descriptionParts.join(' ').slice(0, 200)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  }
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
    { user, subscription },
  ] = await Promise.all([
    supabase
      .from('offers')
      .select(`
        id, offer_type, offer_title, offer_terms_short,
        estimated_value, cooldown_days, dish_photo_url, end_date, is_active,
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
    getCurrentUserSubscription(),
  ])

  const now = new Date()
  const today = getTodayDateStringInTz(now, DEFAULT_TZ)
  const offers = filterCatalogActiveOffers(offersResult.data ?? [], today)
  const offersError = offersResult.error
  const primaryLocation = primaryLocationResult.data
  const hasSubscription = isSubscriptionCurrentlyActive(subscription)

  const cooldownDaysLeftByOfferId =
    hasSubscription && user && offers.length > 0
      ? await loadCooldownDaysLeft(supabase, user.id, offers)
      : {}

  if (offersError) {
    logServerError('r/[slug]/offers', offersError)
    return (
      <main className="mx-auto max-w-3xl">
        <h1 className="px-5 py-10 text-2xl font-medium">{restaurant.restaurant_name}</h1>
        <p className="px-5 text-sm text-red-600">
          Не удалось загрузить офферы.
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
  const addressLine = restaurant.address?.trim() || `${restaurant.restaurant_name}, Алматы`
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

  const maxSavings = offers.reduce<number>((acc, offer) => {
    if (typeof offer.estimated_value === 'number' && offer.estimated_value > 0) {
      return Math.max(acc, offer.estimated_value)
    }
    return acc
  }, 0)
  const maxSavingsLabel = maxSavings > 0
    ? `${new Intl.NumberFormat('ru-RU').format(Math.round(maxSavings / 100) * 100)} ₸`
    : null

  return (
    <>
      <MetaPixelViewContent
        restaurantName={restaurant.restaurant_name}
        restaurantSlug={restaurant.slug}
      />
      <RestaurantNavBar
        shareTitle={restaurant.restaurant_name}
        shareText={`${restaurant.restaurant_name} — офферы Kudaclub`}
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
            Офферы по подписке
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
                cooldown_days: offer.cooldown_days,
                dish_photo_url: offer.dish_photo_url,
                usableHoursLabel: usableStatus.label,
                isOutsideUsableHours: !usableStatus.isUsable,
              }
            })}
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            restaurantName={restaurant.restaurant_name}
            hasSubscription={hasSubscription}
            cooldownDaysLeftByOfferId={cooldownDaysLeftByOfferId}
          />
        </section>

        <RestaurantHowToUse />

        {!hasSubscription ? (
          <RestaurantSubscribeBanner
            restaurantName={restaurant.restaurant_name}
            restaurantSlug={restaurant.slug}
            maxSavingsLabel={maxSavingsLabel}
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
