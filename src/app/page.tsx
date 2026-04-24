import { createSupabasePublicClient } from '@/lib/supabase/public'
import { RestaurantListClient } from '@/components/restaurant-list-client'
import { HomeMobileControls } from '@/components/home/home-mobile-controls'
import { DEFAULT_TZ, computeOpenStatus, type RestaurantHour } from '@/lib/opening-hours'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type Offer = {
  offer_type: '2for1' | 'compliment'
  offer_title: string
  offer_terms_short: string
  estimated_value?: number | null
  cooldown_days?: number | null
  is_active: boolean
}

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  cover_photo_url?: string | null

  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
  restaurant_locations?: {
    lat: number | null
    lng: number | null
    is_active: boolean
    sort_order: number
  }[]
}

type PageProps = {
  searchParams: Promise<{
    open?: string
    type?: string
    cuisine?: string
    offer?: string
    openNow?: string
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
  const {
    cuisine = 'all',
    type,
    offer: offerLegacy,
    open,
    openNow: openNowLegacy,
  } = await searchParams

  const offer = type ?? offerLegacy ?? 'all'
  const openNow = (open ?? openNowLegacy ?? '0') === '1'
  const supabase = createSupabasePublicClient()
  const now = new Date()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id,
      restaurant_name,
      slug,
      address,
      cuisine,  
      cuisine_2,
      cuisine_3,
      offers (
        offer_type,
        offer_title,
        offer_terms_short,
        estimated_value,
        cooldown_days,
        is_active
      ),
      restaurant_hours (
        day_of_week,
        is_closed,
        open_time,
        close_time,
        close_next_day
      ),
      restaurant_locations (
        lat,
        lng,
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
    restaurant_hours: r.restaurant_hours ?? [],
  }))

  const photoByRestaurantId = new Map<string, string>()
  if (safeRestaurants.length > 0) {
    const restaurantIds = safeRestaurants.map((item) => item.id)
    const { data: photos } = await supabase
      .from('restaurant_photos')
      .select('restaurant_id, thumb_url, sort_order')
      .in('restaurant_id', restaurantIds)
      .eq('is_active', true)
      .order('restaurant_id', { ascending: true })
      .order('sort_order', { ascending: true })

    for (const photo of photos ?? []) {
      if (!photoByRestaurantId.has(photo.restaurant_id)) {
        photoByRestaurantId.set(photo.restaurant_id, photo.thumb_url)
      }
    }
  }

  const restaurantsWithStatus = safeRestaurants.map((restaurant) => ({
    ...restaurant,
    cover_photo_url: photoByRestaurantId.get(restaurant.id) ?? null,
    openStatus: computeOpenStatus(restaurant.restaurant_hours ?? [], now, DEFAULT_TZ),
  }))

  const cuisines = Array.from(
    new Set(
      safeRestaurants
        .flatMap((r) => [r.cuisine, r.cuisine_2, r.cuisine_3])
        .map((x) => (x || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'ru'))

  const filteredRestaurants = restaurantsWithStatus.filter((r) => {
    const cuisinesFilter = cuisine === 'all'
      ? []
      : cuisine.split(',').map((x) => x.trim()).filter(Boolean)
    const offersFilter = offer === 'all'
      ? []
      : offer.split(',').map((x) => x.trim()).filter(Boolean)

    const cuisineOk =
      cuisinesFilter.length === 0
        ? true
        : [r.cuisine, r.cuisine_2, r.cuisine_3]
            .filter(Boolean)
            .some((c) => cuisinesFilter.includes(c as string))

    const offerOk =
      offersFilter.length === 0
        ? true
        : r.offers.some((o) => offersFilter.includes(o.offer_type))

    const openNowOk = !openNow || r.openStatus.isOpen

    return cuisineOk && offerOk && openNowOk
  })

  const totalVenues = restaurantsWithStatus.length
  const venuesWord = ruCountWord(totalVenues, ['заведении', 'заведениях', 'заведениях'])
  const whatsappText = encodeURIComponent(
    'Здравствуйте! Хочу подписку Kudaclub за 1 990 ₸'
  )
  const whatsappHref = `https://wa.me/77066059899?text=${whatsappText}`

  const coffeeCuisine = matchCuisine(cuisines, /кофе/, /кафе/, /coffee/)
  const brunchCuisine = matchCuisine(cuisines, /бранч/, /brunch/)
  const sushiCuisine = matchCuisine(cuisines, /суши/, /sushi/, /японск/)
  const veganCuisine = matchCuisine(cuisines, /веган/, /vegan/, /растител/, /вегетариан/)

  type QuickChip = { label: string; href: string; isActive: boolean }

  const quickChips: QuickChip[] = [
    {
      label: 'Открыто сейчас',
      href: homeQuery({
        cuisine,
        type: offer,
        open: openNow ? '' : '1',
      }),
      isActive: openNow,
    },
    {
      label: '2за1',
      href: homeQuery({
        cuisine,
        type: offer === '2for1' ? '' : '2for1',
        open: openNow ? '1' : '',
      }),
      isActive: offer === '2for1',
    },
    {
      label: 'В подарок',
      href: homeQuery({
        cuisine,
        type: offer === 'compliment' ? '' : 'compliment',
        open: openNow ? '1' : '',
      }),
      isActive: offer === 'compliment',
    },
    ...(coffeeCuisine
      ? [
          {
            label: 'Кофе',
            href: homeQuery({ cuisine: coffeeCuisine, open: openNow ? '1' : '', type: offer === 'all' ? '' : offer }),
            isActive: cuisine === coffeeCuisine && offer === 'all',
          },
        ]
      : []),
    ...(brunchCuisine
      ? [
          {
            label: 'Бранч',
            href: homeQuery({ cuisine: brunchCuisine, open: openNow ? '1' : '', type: offer === 'all' ? '' : offer }),
            isActive: cuisine === brunchCuisine && offer === 'all',
          },
        ]
      : []),
    ...(sushiCuisine
      ? [
          {
            label: 'Суши',
            href: homeQuery({ cuisine: sushiCuisine, open: openNow ? '1' : '', type: offer === 'all' ? '' : offer }),
            isActive: cuisine === sushiCuisine && offer === 'all',
          },
        ]
      : []),
    ...(veganCuisine
      ? [
          {
            label: 'Веган',
            href: homeQuery({ cuisine: veganCuisine, open: openNow ? '1' : '', type: offer === 'all' ? '' : offer }),
            isActive: cuisine === veganCuisine && offer === 'all',
          },
        ]
      : []),
  ]

  return (
    <>
      {/* HERO */}
      <section className="px-5">
        <div className="mx-auto max-w-3xl py-10 text-center md:py-16">
          <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs text-primary-dark">
            От создателей Kudafest · Алматы
          </span>

          <h1 className="mt-6 text-3xl font-medium leading-[1.15] tracking-[-0.02em] text-neutral-900 md:text-5xl">
            Ужин вдвоём
            <br />
            по цене <span className="text-primary">одного</span>
          </h1>

          <p className="mx-auto mt-5 max-w-[480px] text-sm text-neutral-600 md:text-base">
            Подписка 1 990 ₸/мес → 2-за-1 и подарки в {totalVenues}{' '}
            {venuesWord} Алматы. Окупается первым визитом.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              Попробовать за 1 990 ₸
            </a>
            <a
              href="#venues"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-transparent px-6 py-3.5 text-base font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2"
            >
              Смотреть заведения
            </a>
          </div>

          <ul className="mt-6 flex flex-col items-center gap-2 text-xs text-neutral-500 sm:flex-row sm:justify-center sm:gap-6">
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon />
              1 визит окупает подписку
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon />
              Отмена в любой момент
            </li>
          </ul>
        </div>
      </section>

      {/* ЭКОНОМИКА ПОДПИСКИ */}
      <section className="bg-neutral-50 py-8 md:py-12">
        <div className="mx-auto max-w-4xl px-5">
          <div className="rounded-xl bg-primary-light px-5 py-6 md:px-7 md:py-8">
            <p className="text-xs font-medium uppercase tracking-wide text-primary-dark">
              Экономика подписки
            </p>
            <h2 className="mt-2 text-2xl font-medium leading-tight text-neutral-900">
              1 подписка = 4 ужина по цене одного
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Подписка стоит 1 990 ₸. Одно 2-за-1 экономит в среднем 2 500 ₸.
              Всё, что дальше — в плюс.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-white p-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-primary-dark">
                  Без Kudaclub
                </p>
                <p className="text-2xl font-medium text-neutral-900">6 000 ₸</p>
                <p className="mt-1 text-xs text-neutral-600">Ужин на двоих</p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-primary-dark">
                  С Kudaclub
                </p>
                <p className="text-2xl font-medium text-success">3 500 ₸</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Каждый ужин +2 500 ₸ экономии
                </p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-primary-dark">
                  За месяц
                </p>
                <p className="text-2xl font-medium text-neutral-900">≈ 10 000 ₸</p>
                <p className="mt-1 text-xs text-neutral-600">
                  При 4 визитах в месяц
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* СПИСОК ЗАВЕДЕНИЙ (не трогаем, только добавлен якорь #venues) */}
      <div
        id="venues"
        className="mx-auto max-w-6xl px-5 py-8 pb-24 md:py-12 md:pb-12"
      >
        <RestaurantListClient
          restaurants={filteredRestaurants}
          quickChips={quickChips}
        />

        <HomeMobileControls
          cuisineOptions={cuisines}
          applyCount={filteredRestaurants.length}
        />
      </div>
    </>
  )
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
