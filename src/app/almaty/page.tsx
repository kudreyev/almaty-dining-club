import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type Offer = {
  id: string
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  is_active: boolean
}

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  district: string
  address: string
  cuisine: string
  short_description: string
  working_hours: string
  price_level: 'low' | 'mid' | 'high'
  photo_1_url: string | null
  offers: Offer[]
}

type PageProps = {
  searchParams: Promise<{
    q?: string
    offer?: string
  }>
}

function getOfferBadgeLabel(type: Offer['offer_type']) {
  if (type === '2for1') return '1+1'
  return 'Комплимент'
}

function getPriceLevelLabel(level: Restaurant['price_level']) {
  if (level === 'low') return '₸'
  if (level === 'mid') return '₸₸'
  return '₸₸₸'
}

export default async function AlmatyPage({ searchParams }: PageProps) {
  const { q = '', offer = 'all' } = await searchParams
  const supabase = await createSupabaseServerClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(`
      id,
      restaurant_name,
      slug,
      district,
      address,
      cuisine,
      short_description,
      working_hours,
      price_level,
      photo_1_url,
      offers (
        id,
        offer_type,
        offer_title,
        offer_terms_short,
        is_active
      )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-3xl font-semibold">Рестораны Алматы</h1>
        <p className="mt-4 text-red-600">
          Ошибка загрузки ресторанов: {error.message}
        </p>
      </main>
    )
  }

  const normalizedQuery = q.trim().toLowerCase()

  const filteredRestaurants = (restaurants as Restaurant[]).filter((restaurant) => {
    const matchesQuery =
      !normalizedQuery ||
      restaurant.restaurant_name.toLowerCase().includes(normalizedQuery) ||
      restaurant.cuisine.toLowerCase().includes(normalizedQuery) ||
      restaurant.district.toLowerCase().includes(normalizedQuery)

    const activeOffers = (restaurant.offers || []).filter((item) => item.is_active)

    const matchesOffer =
      offer === 'all' ||
      activeOffers.some((item) => item.offer_type === offer)

    return matchesQuery && matchesOffer
  })

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Рестораны Алматы</h1>
        <p className="mt-2 text-gray-600">
          Подборка партнёров с офферами 1+1 и комплиментами.
        </p>
      </div>

      <form className="mb-8 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.5fr]">
          <div>
            <label htmlFor="q" className="mb-2 block text-sm font-medium text-gray-700">
              Поиск
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Название, кухня или район"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none ring-0 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="offer" className="mb-2 block text-sm font-medium text-gray-700">
              Тип оффера
            </label>
            <select
              id="offer"
              name="offer"
              defaultValue={offer}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            >
              <option value="all">Все офферы</option>
              <option value="2for1">1+1</option>
              <option value="compliment">Комплимент</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
            >
              Применить
            </button>
          </div>
        </div>
      </form>

      <div className="mb-6 text-sm text-gray-500">
        Найдено ресторанов: {filteredRestaurants.length}
      </div>

      {filteredRestaurants.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
          По вашему запросу ничего не найдено.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((restaurant) => {
            const activeOffers = (restaurant.offers || []).filter((item) => item.is_active)
            const primaryOffer = activeOffers[0]

            return (
              <article
                key={restaurant.id}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] bg-gray-100">
                  {restaurant.photo_1_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={restaurant.photo_1_url}
                      alt={restaurant.restaurant_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      Нет фото
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {restaurant.restaurant_name}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {restaurant.cuisine} · {restaurant.district}
                      </p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {getPriceLevelLabel(restaurant.price_level)}
                    </span>
                  </div>

                  {primaryOffer ? (
                    <div className="mb-4 rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                          {getOfferBadgeLabel(primaryOffer.offer_type)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {activeOffers.length} оффер{activeOffers.length > 1 ? 'а' : ''}
                        </span>
                      </div>

                      <p className="mt-3 text-sm font-medium text-gray-900">
                        {primaryOffer.offer_title}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {primaryOffer.offer_terms_short}
                      </p>
                    </div>
                  ) : null}

                  <p className="text-sm text-gray-700">
                    {restaurant.short_description}
                  </p>

                  <div className="mt-4 space-y-1 text-sm text-gray-500">
                    <p>{restaurant.address}</p>
                    <p>{restaurant.working_hours}</p>
                  </div>

                  <Link
                    href={`/r/${restaurant.slug}`}
                    className="mt-5 inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    Открыть ресторан
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}