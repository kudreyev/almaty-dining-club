import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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
  offer_terms_full: string
  offer_days: string
  offer_time_from: string
  offer_time_to: string
  requires_main_course: boolean
  is_stackable_with_other_promos: boolean
  is_active: boolean
}

type PageProps = {
  params: Promise<{ slug: string }>
}

const OPTIMIZED_IMAGE_HOSTS = ['supabase.co', 'supabase.in']

function isOptimizedImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return OPTIMIZED_IMAGE_HOSTS.some((h) => host === h || host.endsWith('.' + h))
  } catch {
    return false
  }
}

export const revalidate = 300

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

  const [locationsResult, offersResult] = await Promise.all([
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
        id, offer_type, offer_title, offer_terms_short, offer_terms_full,
        offer_days, offer_time_from, offer_time_to,
        requires_main_course, is_stackable_with_other_promos, is_active
      `)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  const activeLocations = locationsResult.data ?? []
  const { data: offers, error: offersError } = offersResult

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
            {photoUrls.length === 0 ? (
              <div className="flex aspect-[4/3] items-center justify-center bg-gray-50 text-sm text-gray-300">
                Нет фото
              </div>
            ) : photoUrls.length === 1 ? (
              <div className="relative aspect-[4/3] bg-gray-100">
                {isOptimizedImageUrl(photoUrls[0]) ? (
                  <Image
                    src={photoUrls[0]}
                    alt={restaurant.restaurant_name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 720px, 100vw"
                    priority
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrls[0]}
                    alt={restaurant.restaurant_name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {photoUrls.map((url, idx) => (
                    <div key={url} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-gray-100">
                      {isOptimizedImageUrl(url) ? (
                        <Image
                          src={url}
                          alt={`${restaurant.restaurant_name}, фото ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="(min-width: 1024px) 720px, 100vw"
                          priority={idx === 0}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`${restaurant.restaurant_name}, фото ${idx + 1}`}
                          className="h-full w-full object-cover"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                  {photoUrls.map((_, idx) => (
                    <span
                      key={idx}
                      className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-sm"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            )}
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
        <div>
          <Card className="sticky top-20">
            <h2 className="text-lg font-bold">Офферы</h2>
            <p className="mt-1 text-sm text-gray-500">
              Доступно по подписке
            </p>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
              <p className="font-medium text-gray-700">Как использовать</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-gray-500">
                <li>Оформи подписку</li>
                <li>Нажми «Активировать» — получи код</li>
                <li>Покажи код персоналу</li>
              </ol>
            </div>

            <div className="mt-5 space-y-4">
              {!offers || offers.length === 0 ? (
                <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                  Пока нет активных офферов
                </div>
              ) : (
                offers.map((offer: Offer) => (
                  <div key={offer.id} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge color="dark">
                        {offer.offer_type === '2for1' ? '1+1' : 'Комплимент'}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {offer.offer_time_from.slice(0, 5)}–{offer.offer_time_to.slice(0, 5)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-sm font-semibold">{offer.offer_title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">
                      {offer.offer_terms_short}
                    </p>

                    {offer.offer_terms_full ? (
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">
                        {offer.offer_terms_full}
                      </p>
                    ) : null}

                    <div className="mt-3 space-y-0.5 text-xs text-gray-400">
                      <p>Дни: {offer.offer_days}</p>
                      {offer.requires_main_course ? <p>Требуется основное блюдо</p> : null}
                      {!offer.is_stackable_with_other_promos ? <p>Не суммируется с другими акциями</p> : null}
                    </div>

                    <Button
                      href={`/app/redeem/${restaurant.id}/${offer.id}`}
                      size="md"
                      className="mt-4 w-full"
                    >
                      Активировать
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <Button href="/pricing" variant="secondary" className="w-full">
                Оформить подписку
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
