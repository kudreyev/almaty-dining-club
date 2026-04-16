import { createSupabasePublicClient } from '@/lib/supabase/public'
import { Button } from '@/components/ui/button'
import { RestaurantListClient } from '@/components/restaurant-list-client'
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
  const { cuisine = 'all', offer = 'all', openNow: openNowRaw = '0' } = await searchParams
  const openNow = openNowRaw === '1'
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

    const openNowOk = !openNow || r.openStatus.isOpen

    return cuisineOk && offerOk && openNowOk
  })

  const totalVenues = restaurantsWithStatus.length
  const totalActiveOffers = restaurantsWithStatus.reduce((sum, r) => sum + r.offers.length, 0)

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
        offer,
        openNow: openNow ? '' : '1',
      }),
      isActive: openNow,
    },
    {
      label: '2за1',
      href: homeQuery({
        cuisine,
        offer: offer === '2for1' ? '' : '2for1',
        openNow: openNow ? '1' : '',
      }),
      isActive: offer === '2for1',
    },
    {
      label: 'В подарок',
      href: homeQuery({
        cuisine,
        offer: offer === 'compliment' ? '' : 'compliment',
        openNow: openNow ? '1' : '',
      }),
      isActive: offer === 'compliment',
    },
    ...(coffeeCuisine
      ? [
          {
            label: 'Кофе',
            href: homeQuery({ cuisine: coffeeCuisine, openNow: openNow ? '1' : '' }),
            isActive: cuisine === coffeeCuisine && offer === 'all',
          },
        ]
      : []),
    ...(brunchCuisine
      ? [
          {
            label: 'Бранч',
            href: homeQuery({ cuisine: brunchCuisine, openNow: openNow ? '1' : '' }),
            isActive: cuisine === brunchCuisine && offer === 'all',
          },
        ]
      : []),
    ...(sushiCuisine
      ? [
          {
            label: 'Суши',
            href: homeQuery({ cuisine: sushiCuisine, openNow: openNow ? '1' : '' }),
            isActive: cuisine === sushiCuisine && offer === 'all',
          },
        ]
      : []),
    ...(veganCuisine
      ? [
          {
            label: 'Веган',
            href: homeQuery({ cuisine: veganCuisine, openNow: openNow ? '1' : '' }),
            isActive: cuisine === veganCuisine && offer === 'all',
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      {/* HERO */}
      <section className="relative -mx-5 mb-8 md:mx-0 md:mb-10">
        <div className="bg-gradient-to-b from-stone-400/[0.07] via-orange-50/[0.025] to-background px-5 py-10 md:rounded-3xl md:px-8 md:py-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Алматы
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-gray-950 sm:text-4xl">
            2за1 и подарки в ресторанах по&nbsp;подписке
          </h1>
          <p className="mt-4 max-w-xl text-base leading-6 text-gray-500">
            Выбирай заведение, показывай код персоналу. Без купонов и распечаток.
          </p>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-base leading-6 text-gray-600">
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
        </div>
      </section>

      <RestaurantListClient restaurants={filteredRestaurants} quickChips={quickChips} />
    </div>
  )
}
