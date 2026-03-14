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
  district: string
  cuisine: string
  short_description: string
  price_level: 'low' | 'mid' | 'high'
  photo_1_url: string | null
  offers: Offer[]
}

function priceLabel(level: Restaurant['price_level']) {
  if (level === 'low') return '₸'
  if (level === 'mid') return '₸₸'
  return '₸₸₸'
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id,
      restaurant_name,
      slug,
      district,
      cuisine,
      short_description,
      price_level,
      photo_1_url,
      offers (
        id,
        offer_key,
        offer_type,
        offer_title,
        offer_terms_short,
        is_active
      )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })
    .returns<Restaurant[]>()

  const safeRestaurants = (restaurants ?? []).map((r) => ({
    ...r,
    offers: (r.offers ?? []).filter((o) => o.is_active),
  }))

  // соберем "витрину офферов" (по 1 офферу на ресторан)
  const topOffers = safeRestaurants
    .filter((r) => r.offers.length > 0)
    .slice(0, 9)
    .map((r) => ({
      restaurantId: r.id,
      restaurantName: r.restaurant_name,
      restaurantSlug: r.slug,
      district: r.district,
      cuisine: r.cuisine,
      offer: r.offers[0],
    }))

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
          Выбирай заведение, активируй оффер и покажи код персоналу. Без купонов и распечаток.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/pricing"
            className="inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white"
          >
            Оформить подписку
          </Link>

          <Link
            href="/almaty"
            className="inline-flex rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black"
          >
            Смотреть все рестораны
          </Link>
        </div>

        {/* MINI ONBOARDING */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">1) Подписка</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Оплати и отправь “Я оплатил” — мы активируем доступ.
            </p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">2) Активируй оффер</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Нажми “Активировать” — получишь код на 10 минут.
            </p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">3) Покажи код</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Персонал проверит код в staff-панели — и применит оффер.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold text-gray-900">Правила (MVP)</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>Код действует 10 минут</li>
            <li>Одновременно можно иметь только 1 активный код</li>
            <li>В одном ресторане — не чаще 1 раза в 30 дней</li>
            <li>Офферы не суммируются с другими акциями (если не указано иначе)</li>
          </ul>
        </div>
      </section>

      {/* TOP OFFERS */}
      <section className="mt-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Офферы прямо сейчас</h2>
            <p className="mt-2 text-sm text-gray-600">
              Быстрый выбор: популярные офферы от партнёров.
            </p>
          </div>
          <Link href="/almaty" className="text-sm text-gray-600 underline">
            Смотреть все
          </Link>
        </div>

        {topOffers.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
            Пока нет активных офферов.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {topOffers.map((item) => (
              <article
                key={item.offer.id}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                    {offerTypeLabel(item.offer.offer_type)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    по подписке
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-semibold">{item.offer.offer_title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.offer.offer_terms_short}</p>

                <p className="mt-4 text-sm text-gray-500">
                  {item.restaurantName} · {item.cuisine} · {item.district}
                </p>

                <div className="mt-6 flex gap-3">
                  <Link
                    href={`/r/${item.restaurantSlug}`}
                    className="inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Открыть
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    Подписка
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* RESTAURANTS GRID */}
      <section className="mt-12">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Рестораны</h2>
          <p className="mt-2 text-sm text-gray-600">
            Все партнёры в Алматы. Офферы открываются по подписке.
          </p>
        </div>

        {safeRestaurants.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-gray-600 shadow-sm">
            Пока нет активных ресторанов.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {safeRestaurants.slice(0, 9).map((r) => (
              <article
                key={r.id}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
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
                      <p className="mt-1 text-sm text-gray-500">
                        {r.cuisine} · {r.district}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {priceLabel(r.price_level)}
                    </span>
                  </div>

                  {r.offers[0] ? (
                    <div className="mb-4 rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                            {offerTypeLabel(r.offers[0].offer_type)}
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            по подписке
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {r.offers.length} оффер{r.offers.length > 1 ? 'а' : ''}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-gray-900">
                        {r.offers[0].offer_title}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {r.offers[0].offer_terms_short}
                      </p>
                    </div>
                  ) : null}

                  <p className="text-sm text-gray-700">{r.short_description}</p>

                  <Link
                    href={`/r/${r.slug}`}
                    className="mt-5 inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
                  >
                    Открыть ресторан
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/almaty"
            className="inline-flex rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-black"
          >
            Смотреть весь каталог
          </Link>
        </div>
      </section>
    </main>
  )
}