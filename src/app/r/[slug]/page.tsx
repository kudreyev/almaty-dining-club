import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentUserSubscription, isSubscriptionCurrentlyActive } from '@/lib/subscription'
import { RestaurantPhotoGallery } from '@/components/restaurant-photo-gallery'
import { OffersPanel } from '@/components/offers-panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

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
  photo_1_url: string | null
  photo_2_url: string | null
  photo_3_url: string | null
  is_active: boolean
}

type Offer = {
  id: string
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  estimated_value?: number | null
  cooldown_days?: number | null
  is_active: boolean
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
      photo_1_url, photo_2_url, photo_3_url, is_active
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single<Restaurant>()

  if (restaurantError || !restaurant) notFound()

  type RestaurantLocation = {
    id: string
    address: string
    phone: string | null
    sort_order: number
  }

  const [locationsResult, offersResult, { subscription }] = await Promise.all([
    supabase
      .from('restaurant_locations')
      .select('id, address, phone, sort_order')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<RestaurantLocation[]>(),
    supabase
      .from('offers')
      .select(`
        id, offer_type, offer_title, offer_terms_short,
        estimated_value, cooldown_days, is_active
      `)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    getCurrentUserSubscription(),
  ])

  const activeLocations = locationsResult.data ?? []
  const { data: offers, error: offersError } = offersResult
  const hasSubscription = isSubscriptionCurrentlyActive(subscription)

  if (offersError) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-bold">{restaurant.restaurant_name}</h1>
        <p className="mt-4 text-sm text-red-600">
          Ошибка загрузки офферов: {offersError.message}
        </p>
      </div>
    )
  }

  const photoUrls = [restaurant.photo_1_url, restaurant.photo_2_url, restaurant.photo_3_url].filter(
    (u): u is string => Boolean(u)
  )

  const cuisines = [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3].filter(Boolean) as string[]

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

            <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
              {restaurant.restaurant_name}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {restaurant.short_description}
            </p>

            {/* ADDRESS */}
            {(activeLocations.length > 0 || restaurant.address) ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Адрес</p>
                {activeLocations.length > 1 ? (
                  <ul className="mt-2 space-y-1 text-sm text-gray-700">
                    {activeLocations.map((loc) => (
                      <li key={loc.id} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                        {loc.address}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-gray-700">
                    {activeLocations[0]?.address ?? restaurant.address}
                  </p>
                )}
              </div>
            ) : null}

            {/* LINKS */}
            <div className="mt-4 flex flex-wrap gap-2">
              {restaurant.two_gis_url ? (
                <Button href={restaurant.two_gis_url} variant="secondary" size="sm" target="_blank" rel="noreferrer">
                  Открыть в 2GIS
                </Button>
              ) : null}
              {restaurant.instagram_url ? (
                <Button href={restaurant.instagram_url} variant="secondary" size="sm" target="_blank" rel="noreferrer">
                  Instagram
                </Button>
              ) : null}
              {(() => {
                const phone = activeLocations[0]?.phone ?? restaurant.phone
                return phone ? (
                  <Button href={`tel:${phone}`} variant="ghost" size="sm">
                    {phone}
                  </Button>
                ) : null
              })()}
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
