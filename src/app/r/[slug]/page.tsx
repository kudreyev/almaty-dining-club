import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentUserSubscription, isSubscriptionCurrentlyActive } from '@/lib/subscription'
import { RestaurantPhotoGallery } from '@/components/restaurant-photo-gallery'
import { RestaurantMapCard } from '@/components/restaurant-map-card'
import { OffersPanel } from '@/components/offers-panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DEFAULT_TZ,
  WEEKDAY_LABELS_RU,
  computeOpenStatus,
  formatHoursRange,
  type RestaurantHour,
} from '@/lib/opening-hours'

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  city: string
  address: string
  phone: string | null
  instagram_url: string | null
  website_url: string | null
  two_gis_url: string | null
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string
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
      id, restaurant_name, slug, city, address, phone,
      instagram_url, website_url, two_gis_url,
      cuisine, cuisine_2, cuisine_3, short_description,
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
  const hoursByDay = new Map(hoursForWeek.map((item) => [item.day_of_week, item]))
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

  console.warn(
    `[restaurant-map] slug=${restaurant.slug} previewMapUrl=${staticMapUrl ?? 'none'} backupMapUrl=none`
  )

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT */}
        <div className="space-y-6">
          {/* GALLERY */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <RestaurantPhotoGallery photoUrls={photoUrls} restaurantName={restaurant.restaurant_name} />
          </div>

          {/* INFO */}
          <Card>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {restaurant.restaurant_name}
            </h1>

            <p className="mt-3 text-base leading-6 text-gray-600">
              {restaurant.short_description}
            </p>

            <div className="mt-6 rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-medium uppercase tracking-wider text-gray-400">Режим работы</p>
              <p className={`mt-2 text-base font-medium ${openStatus.isOpen ? 'text-emerald-700' : 'text-gray-700'}`}>
                {openStatus.labelShort}
              </p>
              {openStatus.labelDetail ? (
                <p className="mt-1 text-sm text-gray-500">{openStatus.labelDetail}</p>
              ) : null}
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                {Array.from({ length: 7 }, (_, idx) => idx + 1).map((day) => (
                  <p key={day}>
                    <span className="font-medium text-gray-700">{WEEKDAY_LABELS_RU[day]}:</span>{' '}
                    {formatHoursRange(hoursByDay.get(day))}
                    {hoursByDay.get(day)?.close_next_day ? (
                      <span className="text-xs text-gray-400"> (на следующий день)</span>
                    ) : null}
                  </p>
                ))}
              </div>
            </div>

            {/* ADDRESS */}
            {restaurant.address ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-medium uppercase tracking-wider text-gray-400">Адрес</p>
                <p className="mt-1.5 text-base leading-6 text-gray-700">{restaurant.address}</p>
              </div>
            ) : null}

            <RestaurantMapCard
              addressLine={addressLine}
              staticMapUrl={staticMapUrl}
              backupMapUrl={backupMapUrl}
              twoGisUrl={restaurant.two_gis_url}
              mapTargetUrl={mapTargetUrl}
              yandexMapUrl={yandexMapUrl}
              noCoords={noCoords}
            />

            {/* LINKS */}
            <div className="mt-4 flex flex-wrap gap-2">
              {restaurant.instagram_url ? (
                <Button href={restaurant.instagram_url} variant="secondary" size="sm" target="_blank" rel="noreferrer">
                  Instagram
                </Button>
              ) : null}
              {restaurant.phone ? (
                <Button href={`tel:${restaurant.phone}`} variant="ghost" size="sm">
                  {restaurant.phone}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>

        {/* RIGHT — OFFERS */}
        <div className="lg:sticky lg:top-20">
          <OffersPanel
            offers={offers ?? []}
            restaurantId={restaurant.id}
            hasSubscription={hasSubscription}
          />
        </div>
      </div>
    </div>
  )
}
