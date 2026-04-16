import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildWhatsAppUrl } from '@/lib/kz-phone'
import { getCurrentUserSubscription, isSubscriptionCurrentlyActive } from '@/lib/subscription'
import { OpeningHoursDropdown } from '@/components/opening-hours-dropdown'
import { RestaurantPhotoGallery } from '@/components/restaurant-photo-gallery'
import { RestaurantMapCard } from '@/components/restaurant-map-card'
import { OffersPanel } from '@/components/offers-panel'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DEFAULT_TZ,
  computeOpenStatus,
  type RestaurantHour,
} from '@/lib/opening-hours'

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
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  is_active: boolean
  restaurant_hours?: RestaurantHour[]
}

type PrimaryLocation = {
  lat: number | null
  lng: number | null
}

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function RestaurantPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select(`
      id, restaurant_name, slug, city, address, phone, whatsapp_phone,
      instagram_url, website_url, two_gis_url,
      cuisine, cuisine_2, cuisine_3,
      is_active,
      restaurant_hours ( day_of_week, is_closed, open_time, close_time, close_next_day )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single<Restaurant>()

  if (restaurantError || !restaurant) notFound()

  const [offersResult, photosResult, primaryLocationResult, { subscription }] = await Promise.all([
    supabase
      .from('offers')
      .select(`
        id, offer_type, offer_title, offer_terms_short,
        estimated_value, cooldown_days, is_active
      `)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('restaurant_photos')
      .select('full_url')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
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

  const { data: offers, error: offersError } = offersResult
  const primaryLocation = primaryLocationResult.data
  const hasSubscription = isSubscriptionCurrentlyActive(subscription)

  if (offersError) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">{restaurant.restaurant_name}</h1>
        <p className="mt-4 text-sm text-red-600">
          Ошибка загрузки офферов: {offersError.message}
        </p>
      </div>
    )
  }

  const photoUrls = (photosResult.data ?? [])
    .map((item) => item.full_url)
    .filter((u): u is string => Boolean(u))

  const cuisines = [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3].filter(Boolean) as string[]
  const hoursForWeek = restaurant.restaurant_hours ?? []
  const openStatus = computeOpenStatus(hoursForWeek, new Date(), DEFAULT_TZ)
  const addressLine = restaurant.address?.trim() || `${restaurant.restaurant_name}, Алматы`
  const hasCoordinates = primaryLocation?.lat != null && primaryLocation?.lng != null
  const yandexSearchUrl = `https://yandex.kz/maps/?text=${encodeURIComponent(addressLine)}`
  const yandexMapUrl = hasCoordinates
    ? `https://yandex.kz/maps/?pt=${primaryLocation.lng},${primaryLocation.lat}&z=17&l=map`
    : yandexSearchUrl
  const mapTargetUrl = restaurant.two_gis_url || yandexMapUrl
  const staticMapUrl = hasCoordinates
    ? `https://static-maps.yandex.ru/1.x/?lang=ru_RU&ll=${primaryLocation.lng},${primaryLocation.lat}&z=17&l=map&size=650,400&pt=${primaryLocation.lng},${primaryLocation.lat},pm2rdm`
    : null
  const backupMapUrl = null
  const noCoords = !hasCoordinates
  const whatsappUrl = buildWhatsAppUrl(
    restaurant.whatsapp_phone,
    `Здравствуйте! Пишу по поводу заведения ${restaurant.restaurant_name}`
  )

  console.warn(
    `[restaurant-map] slug=${restaurant.slug} previewMapUrl=${staticMapUrl ?? 'none'} backupMapUrl=none`
  )

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">
        {/* GALLERY */}
        <div className="order-1 lg:col-start-1 lg:row-start-1">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <RestaurantPhotoGallery photoUrls={photoUrls} restaurantName={restaurant.restaurant_name} />
          </div>
        </div>

        {/* INFO */}
        <div className="order-2 lg:col-start-1 lg:row-start-2">
          <Card>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {restaurant.restaurant_name}
            </h1>

            <OpeningHoursDropdown status={openStatus} weekSchedule={hoursForWeek} />

            {restaurant.address ? (
              <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">{restaurant.address}</p>
            ) : null}
          </Card>
        </div>

        {/* RIGHT — OFFERS */}
        <div className="order-3 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-20">
          <OffersPanel
            offers={offers ?? []}
            restaurantId={restaurant.id}
            hasSubscription={hasSubscription}
          />
        </div>

        {/* DETAILS */}
        <div className="order-4 lg:col-start-1 lg:row-start-3">
          <RestaurantMapCard
            addressLine={addressLine}
            staticMapUrl={staticMapUrl}
            backupMapUrl={backupMapUrl}
            twoGisUrl={restaurant.two_gis_url}
            mapTargetUrl={mapTargetUrl}
            yandexMapUrl={yandexMapUrl}
            noCoords={noCoords}
            instagramUrl={restaurant.instagram_url}
            whatsappUrl={whatsappUrl}
            phone={restaurant.phone}
          />
        </div>
      </div>
    </div>
  )
}
