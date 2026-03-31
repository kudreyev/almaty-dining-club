import Link from 'next/link'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import { offerTypeLabel } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type Offer = {
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

function matchCuisine(cuisinesSorted: string[], ...patterns: RegExp[]): string | null {
  for (const c of cuisinesSorted) {
    const l = c.toLowerCase()
    if (patterns.some((re) => re.test(l))) return c
  }
  return null
}

function homeQuery(params: Record<string, string>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== 'all') u.set(k, v)
  }
  const qs = u.toString()
  return qs ? `/?${qs}` : '/'
}

/** Склонение для русских существительных (1, 21… / 2–4, 22–24… / остальные). */
function ruCountWord(n: number, forms: [one: string, few: string, many: string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

export default async function HomePage({ searchParams }: PageProps) {
  const { cuisine = 'all', offer = 'all' } = await searchParams
  const supabase = createSupabasePublicClient()

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
        offer_type,
        offer_title,
        offer_terms_short,
        is_active
      ),
      restaurant_locations (
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

  const cuisines = Array.from(
    new Set(
      safeRestaurants
        .flatMap((r) => [r.cuisine, r.cuisine_2, r.cuisine_3])
        .map((x) => (x || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'ru'))

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

  const totalVenues = safeRestaurants.length
  const totalActiveOffers = safeRestaurants.reduce((sum, r) => sum + r.offers.length, 0)

  const coffeeCuisine = matchCuisine(cuisines, /кофе/, /кафе/, /coffee/)
  const brunchCuisine = matchCuisine(cuisines, /бранч/, /brunch/)
  const sushiCuisine = matchCuisine(cuisines, /суши/, /sushi/, /японск/)
  const veganCuisine = matchCuisine(cuisines, /веган/, /vegan/, /растител/, /вегетариан/)

  type QuickChip = { label: string; href: string; isActive: boolean }

  const quickChips: QuickChip[] = [
    {
      label: '1+1',
      href: homeQuery({ offer: '2for1' }),
      isActive: offer === '2for1' && cuisine === 'all',
    },
    ...(coffeeCuisine
      ? [
          {
            label: 'Кофе',
            href: homeQuery({ cuisine: coffeeCuisine }),
            isActive: cuisine === coffeeCuisine && offer === 'all',
          },
        ]
      : []),
    ...(brunchCuisine
      ? [
          {
            label: 'Бранч',
            href: homeQuery({ cuisine: brunchCuisine }),
            isActive: cuisine === brunchCuisine && offer === 'all',
          },
        ]
      : []),
    ...(sushiCuisine
      ? [
          {
            label: 'Суши',
            href: homeQuery({ cuisine: sushiCuisine }),
            isActive: cuisine === sushiCuisine && offer === 'all',
          },
        ]
      : []),
    ...(veganCuisine
      ? [
          {
            label: 'Веган',
            href: homeQuery({ cuisine: veganCuisine }),
            isActive: cuisine === veganCuisine && offer === 'all',
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      {/* HERO */}
      <section className="mb-6 md:mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
          Алматы
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight md:text-5xl md:leading-[1.15]">
          1+1 и комплименты в ресторанах по&nbsp;подписке
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-500">
          Выбирай заведение, показывай код персоналу. Без купонов и распечаток.
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <span>
            <span className="font-semibold text-gray-900">{totalVenues}</span>
            {' '}
            {ruCountWord(totalVenues, ['заведение', 'заведения', 'заведений'])} в Алматы
          </span>
          <span className="hidden text-gray-300 sm:inline" aria-hidden>·</span>
          <span>
            <span className="font-semibold text-gray-900">{totalActiveOffers}</span>
            {' '}
            {ruCountWord(totalActiveOffers, [
              'активное предложение',
              'активных предложения',
              'активных предложений',
            ])}
          </span>
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/pricing" size="lg">
            Оформить подписку
          </Button>
          <Button href="/pricing" variant="secondary" size="lg">
            Как это работает
          </Button>
        </div>
      </section>

      {/* STICKY: quick chips + filter bar */}
      <div className="sticky top-14 z-30 -mx-5 mb-8 border-b border-gray-200/80 bg-background/95 px-5 py-3 backdrop-blur-md sm:-mx-0 sm:rounded-2xl sm:border sm:shadow-sm">
        <p className="mb-2 text-xs font-medium text-gray-500">Быстрый выбор</p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickChips.map((chip) => (
            <Link
              key={`${chip.label}-${chip.href}`}
              href={chip.href}
              scroll={false}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                chip.isActive
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-gray-200/80 bg-white/80 p-3 sm:bg-white">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Кухня</label>
              <select
                name="cuisine"
                defaultValue={cuisine}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
              >
                <option value="all">Все кухни</option>
                {cuisines.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Тип</label>
              <select
                name="offer"
                defaultValue={offer}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
              >
                <option value="all">Все</option>
                <option value="2for1">1+1</option>
                <option value="compliment">Комплимент</option>
              </select>
            </div>

            <Button type="submit" size="lg" className="sm:w-auto">
              Применить
            </Button>
          </form>
        </div>
      </div>

      {/* RESULTS */}
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Рестораны</h2>
        <p className="text-sm text-gray-400">{filteredRestaurants.length} шт.</p>
      </div>

      {filteredRestaurants.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          description="Попробуйте изменить фильтры"
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((r) => (
            <Link
              key={r.id}
              href={`/r/${r.slug}`}
              className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {/* PHOTO */}
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                {r.photo_1_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photo_1_url}
                    alt={r.restaurant_name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-300">
                    Нет фото
                  </div>
                )}
              </div>

              <div className="p-4">
                {/* NAME + CUISINES */}
                <h3 className="text-base font-semibold leading-snug">{r.restaurant_name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[r.cuisine, r.cuisine_2, r.cuisine_3]
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((c) => (
                      <Badge key={c as string}>{c as string}</Badge>
                    ))}
                </div>

                {/* OFFERS */}
                {r.offers.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.offers.slice(0, 2).map((o, i) => (
                      <Badge key={i} color="dark">
                        {offerTypeLabel(o.offer_type)}
                      </Badge>
                    ))}
                    {r.offers.length > 2 ? (
                      <Badge>+{r.offers.length - 2}</Badge>
                    ) : null}
                  </div>
                ) : null}

                {/* ADDRESSES */}
                {(() => {
                  const addresses =
                    (r.restaurant_locations ?? [])
                      .filter((l) => l.is_active)
                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((l) => l.address)
                      .filter(Boolean)

                  if (addresses.length === 0 && r.short_description) {
                    return (
                      <p className="mt-3 text-sm leading-relaxed text-gray-500 line-clamp-2">
                        {r.short_description}
                      </p>
                    )
                  }

                  return addresses.length > 0 ? (
                    <div className="mt-3 space-y-0.5 text-sm text-gray-500">
                      {addresses.slice(0, 2).map((a) => (
                        <p key={a} className="truncate">{a}</p>
                      ))}
                      {addresses.length > 2 ? (
                        <p className="text-gray-400">и ещё {addresses.length - 2}</p>
                      ) : null}
                    </div>
                  ) : null
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
