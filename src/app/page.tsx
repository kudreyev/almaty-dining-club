import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { offerTypeLabel } from '@/lib/labels'

type Offer = {
  id: string
  offer_key?: string | null
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  is_active: boolean
}

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string
  photo_1_url: string | null

  restaurant_locations?: {
    id: string
    address: string
    is_active: boolean
    sort_order: number
  }[]

  offers: Offer[]
}

type PageProps = {
  searchParams: Promise<{
    cuisine?: string
    offer?: string
  }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const { cuisine = 'all', offer = 'all' } = await searchParams
  const supabase = await createSupabaseServerClient()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id,
      restaurant_name,
      slug,
      cuisine,
      cuisine_2,
      cuisine_3,
      short_description,
      photo_1_url,
      offers (
        id,
        offer_key,
        offer_type,
        offer_title,
        offer_terms_short,
        is_active
      ),
      restaurant_locations (
        id,
        address,
        is_active,
        sort_order
      )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })
    .returns<Restaurant[]>()

  const safeRestaurants: Restaurant[] = (restaurants ?? []).map((r) => ({
    ...r,
    offers: (r.offers ?? []).filter((o) => o.is_active),
  }))

  // Список кухонь для фильтра
  const cuisines = Array.from(
    new Set(
      safeRestaurants
        .flatMap((r) => [r.cuisine, r.cuisine_2, r.cuisine_3])
        .map((x) => (x || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'ru'))

  // Фильтрация
  const filteredRestaurants = safeRestaurants.filter((r) => {
    const cuisineOk =
      cuisine === 'all'
        ? true
        : [r.cuisine, r.cuisine_2, r.cuisine_3]
            .filter(Boolean)
            .includes(cuisine)

    const offerOk =
      offer === 'all'
        ? true
        : r.offers.some((o) => o.offer_type === offer)

    return cuisineOk && offerOk
  })

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      {/* HERO */}
      <section className="rounded-[2rem] border border-gray-200 bg-white px-8 py-14 shadow-sm md:px-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
          Алматы · Подписка
        </p>

        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          1+1 и комплименты в ресторанах Алматы — по одной подписке
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          Выбирай заведение, активируй предложение и покажи код персоналу. Без купонов и распечаток.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/pricing"
            className="inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white"
          >
            Оформить подписку
          </Link>

          <Link
            href="/how-it-works"
            className="inline-flex rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black"
          >
            Как это работает
          </Link>
        </div>

      </section>

      {/* FILTERS */}
      <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Кухня
            </label>
            <select
              name="cuisine"
              defaultValue={cuisine}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            >
              <option value="all">Все кухни</option>
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Тип предложения
            </label>
            <select
              name="offer"
              defaultValue={offer}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            >
              <option value="all">Все предложения</option>
              <option value="2for1">1+1</option>
              <option value="compliment">Комплимент</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white"
            >
              Применить
            </button>
          </div>
        </form>

        <div className="mt-4 text-sm text-gray-500">
          Найдено ресторанов: {filteredRestaurants.length}
        </div>
      </section>

      {/* RESTAURANTS GRID (FULL LIST) */}
      <section className="mt-10">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Рестораны</h2>
          <p className="mt-2 text-sm text-gray-600">
            Офферы открываются по подписке.
          </p>
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
            По выбранным фильтрам ничего не найдено.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((r) => (
              <Link
                key={r.id}
                href={`/r/${r.slug}`}
                className="group block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[4/3] bg-gray-100">
                  {r.photo_1_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photo_1_url}
                      alt={r.restaurant_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      Нет фото
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{r.restaurant_name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[r.cuisine, r.cuisine_2, r.cuisine_3]
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((c) => (
                            <span
                              key={c as string}
                              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                            >
                              {c as string}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  {r.offers[0] ? (
                    <div className="mb-4 rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                          {offerTypeLabel(r.offers[0].offer_type)}
                        </span>

                        {r.offers.length === 2 ? (
                          <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                            {offerTypeLabel(r.offers[1].offer_type)}
                          </span>
                        ) : null}

                        {r.offers.length >= 3 ? (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            {r.offers.length} предложения
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-medium text-gray-900">
                        {r.offers[0].offer_title}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {r.offers[0].offer_terms_short}
                      </p>
                      {r.offers.length === 2 ? (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-900">
                            {r.offers[1].offer_title}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            {r.offers[1].offer_terms_short}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {(() => {
                    const addresses =
                      (r.restaurant_locations ?? [])
                        .filter((l) => l.is_active)
                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                        .map((l) => l.address)
                        .filter(Boolean)

                    // fallback: если locations пустые — покажем старый адрес из restaurants.address, если он есть
                    // (если у тебя нет address в select на главной — можно убрать этот fallback)
                    const list = addresses

                    if (list.length === 0) {
                      return (
                        <p className="text-sm text-gray-600">
                          {r.short_description}
                        </p>
                      )
                    }

                    const firstThree = list.slice(0, 3)
                    const hasMore = list.length > 3

                    return (
                      <div className="text-sm text-gray-700">
                        <div className="space-y-1">
                          {firstThree.map((a) => (
                            <p key={a} className="text-gray-700">
                              {a}
                            </p>
                          ))}
                          {hasMore ? (
                            <p className="text-gray-500">и другие</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="mt-5 inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white group-hover:opacity-90">
                    Открыть ресторан
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}