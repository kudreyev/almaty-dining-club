import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  city: string
  district: string
  address: string
  phone: string | null
  instagram_url: string | null
  website_url: string | null
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string
  working_hours: string
  price_level: 'low' | 'mid' | 'high'
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
  params: Promise<{
    slug: string
  }>
}

function getOfferBadgeLabel(type: Offer['offer_type']) {
  if (type === '2for1') return '1+1'
  return 'Комплимент'
}

export default async function RestaurantPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select(`
      id,
      restaurant_name,
      slug,
      city,
      district,
      address,
      phone,
      instagram_url,
      website_url,
      cuisine,
      cuisine_2,
      cuisine_3,
      short_description,
      working_hours,
      price_level,
      photo_1_url,
      photo_2_url,
      photo_3_url,
      is_active
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single<Restaurant>()

  if (restaurantError || !restaurant) {
    notFound()
  }

  type RestaurantLocation = {
    id: string
    address: string
    district: string | null
    phone: string | null
    working_hours: string | null
    sort_order: number
  }

  const { data: locations, error: locationsError } = await supabase
    .from('restaurant_locations')
    .select('id, address, district, phone, working_hours, sort_order')
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<RestaurantLocation[]>()

  if (locationsError) {
    // можно просто игнорировать и показать данные из restaurants
    // не падаем
  }

  const activeLocations = locations ?? []

  const { data: offers, error: offersError } = await supabase
    .from('offers')
    .select(`
      id,
      offer_type,
      offer_title,
      offer_terms_short,
      offer_terms_full,
      offer_days,
      offer_time_from,
      offer_time_to,
      requires_main_course,
      is_stackable_with_other_promos,
      is_active
    `)
    .eq('restaurant_id', restaurant.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (offersError) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-3xl font-semibold">{restaurant.restaurant_name}</h1>
        <p className="mt-4 text-red-600">
          Ошибка загрузки офферов: {offersError.message}
        </p>
      </main>
    )
  }

  const photoUrls = [restaurant.photo_1_url, restaurant.photo_2_url, restaurant.photo_3_url].filter(
    (u): u is string => Boolean(u)
  )

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            {photoUrls.length === 0 ? (
              <div className="aspect-[4/3] bg-gray-100">
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  Нет фото
                </div>
              </div>
            ) : photoUrls.length === 1 ? (
              <div className="aspect-[4/3] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrls[0]}
                  alt={restaurant.restaurant_name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="relative">
                <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
                  {photoUrls.map((url, idx) => (
                    <div key={url} className="aspect-[4/3] w-full shrink-0 snap-center bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${restaurant.restaurant_name} photo ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                  {photoUrls.map((_, idx) => (
                    <span
                      key={idx}
                      className="h-2 w-2 rounded-full bg-white/80"
                      aria-hidden="true"
                    />
                  ))}
                </div>

              </div>
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {[restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
                .filter(Boolean)
                .slice(0, 3)
                .map((c) => (
                  <span
                    key={c as string}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"
                  >
                    {c as string}
                  </span>
                ))}
            </div>

            <h1 className="mt-4 text-3xl font-semibold">
              {restaurant.restaurant_name}
            </h1>

            <p className="mt-3 text-base leading-7 text-gray-700">
              {restaurant.short_description}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2">
                <p className="text-sm font-medium text-gray-900">Адрес</p>

                {activeLocations.length > 1 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                    {activeLocations.map((loc) => (
                      <li key={loc.id}>{loc.address}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">
                    {activeLocations[0]?.address ?? restaurant.address}
                  </p>
                )}
              </div>

              {activeLocations.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Часы работы</p>
                  <p className="mt-1 text-sm text-gray-600">{restaurant.working_hours}</p>
                </div>
              ) : activeLocations.length === 1 ? (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Часы работы</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {activeLocations[0].working_hours ?? restaurant.working_hours}
                  </p>
                </div>
              ) : null}

              {activeLocations.length === 0 && restaurant.phone ? (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Телефон</p>
                  <p className="mt-1 text-sm text-gray-600">{restaurant.phone}</p>
                </div>
              ) : activeLocations.length === 1 ? (
                (activeLocations[0].phone ?? restaurant.phone) ? (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-900">Телефон</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {activeLocations[0].phone ?? restaurant.phone}
                    </p>
                  </div>
                ) : null
              ) : null}

              {restaurant.instagram_url ? (
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Instagram</p>
                  <a
                    href={restaurant.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-black underline"
                  >
                    Перейти в Instagram
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Офферы</h2>
            <p className="mt-2 text-sm text-gray-600">
              Доступно по подписке в Алматы
            </p>
            <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Как использовать</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Оформи подписку</li>
                <li>Нажми “Активировать оффер” и получи код на 10 минут</li>
                <li>Покажи код сотруднику заведения</li>
              </ol>
            </div>
            <div className="mt-6 space-y-4">
              {!offers || offers.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                  Сейчас активных офферов нет.
                </div>
              ) : (
                offers.map((offer: Offer) => (
                  <div
                    key={offer.id}
                    className="rounded-2xl border border-gray-200 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                        {getOfferBadgeLabel(offer.offer_type)}
                      </span>

                      <span className="text-xs text-gray-500">
                        {offer.offer_time_from.slice(0, 5)}–{offer.offer_time_to.slice(0, 5)}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-semibold">{offer.offer_title}</h3>

                    <p className="mt-2 text-sm text-gray-700">
                      {offer.offer_terms_short}
                    </p>

                    <p className="mt-4 text-sm leading-6 text-gray-600">
                      {offer.offer_terms_full}
                    </p>

                    <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">
                      <p><span className="font-medium text-gray-700">Дни:</span> {offer.offer_days}</p>
                      <p>
                        <span className="font-medium text-gray-700">Требует основное блюдо:</span>{' '}
                        {offer.requires_main_course ? 'Да' : 'Нет'}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Суммируется с другими акциями:</span>{' '}
                        {offer.is_stackable_with_other_promos ? 'Да' : 'Нет'}
                      </p>
                    </div>

                    <a
                      href={`/app/redeem/${restaurant.id}/${offer.id}`}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
                    >
                     Активировать оффер
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}