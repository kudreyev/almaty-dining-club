import { createSupabasePublicClient } from '@/lib/supabase/public'
import { VenuesSection } from '@/components/home/venues-section'
import { HomeMobileControls } from '@/components/home/home-mobile-controls'
import {
  DEFAULT_TZ,
  computeOpenStatus,
  type RestaurantHour,
} from '@/lib/opening-hours'
import { pluralizeRu } from '@/lib/ru-plural'
import type { Offer, RestaurantWithStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type SupabaseRow = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
  restaurant_locations?: {
    lat: number | null
    lng: number | null
    is_active: boolean
    sort_order: number
  }[]
}

export default async function HomePage() {
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
    .returns<SupabaseRow[]>()

  const safeRestaurants: SupabaseRow[] = (restaurants ?? []).map((r) => ({
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

  const restaurantsWithStatus: RestaurantWithStatus[] = safeRestaurants.map((restaurant) => ({
    ...restaurant,
    cover_photo_url: photoByRestaurantId.get(restaurant.id) ?? null,
    openStatus: computeOpenStatus(restaurant.restaurant_hours ?? [], now, DEFAULT_TZ),
  }))

  const cuisineFrequency = new Map<string, number>()
  for (const r of safeRestaurants) {
    for (const c of [r.cuisine, r.cuisine_2, r.cuisine_3]) {
      const trimmed = (c ?? '').trim()
      if (!trimmed) continue
      cuisineFrequency.set(trimmed, (cuisineFrequency.get(trimmed) ?? 0) + 1)
    }
  }
  const cuisineOptions = Array.from(cuisineFrequency.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0], 'ru')
    })
    .map(([name]) => name)

  const totalVenues = restaurantsWithStatus.length
  const venuesWord = pluralizeRu(totalVenues, ['заведении', 'заведениях', 'заведениях'])
  const whatsappText = encodeURIComponent(
    'Здравствуйте! Хочу подписку Kudaclub за 1 990 ₸'
  )
  const whatsappHref = `https://wa.me/77066059899?text=${whatsappText}`

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

      {/* СПИСОК ЗАВЕДЕНИЙ */}
      <div
        id="venues"
        className="mx-auto max-w-6xl px-5 py-8 md:py-12"
      >
        <VenuesSection
          restaurants={restaurantsWithStatus}
          cuisineOptions={cuisineOptions}
        />

        <HomeMobileControls
          cuisineOptions={cuisineOptions}
          applyCount={restaurantsWithStatus.length}
        />
      </div>

      {/* КАК ЭТО РАБОТАЕТ */}
      <section className="px-5 pb-24 md:pb-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Как это работает
          </h2>
          <p className="mt-2 text-sm text-neutral-600 md:text-base">
            Три шага. Без купонов, без распечаток, без скидочных карт.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                eyebrow: '01 — ПОДПИШИСЬ',
                title: 'Активация через WhatsApp',
                description: 'Одно сообщение — и ты в клубе. Подписка активируется сразу.',
              },
              {
                eyebrow: '02 — ВЫБЕРИ МЕСТО',
                title: 'Получи код в заведении',
                description:
                  'Нажми «Получить код» на странице заведения, когда уже готов сделать заказ, и покажи официанту.',
              },
              {
                eyebrow: '03 — ПОКАЖИ КОД',
                title: 'Официант активирует оффер',
                description:
                  'Получаешь второе блюдо бесплатно или подарок к основному. Без купонов, без объяснений.',
              },
            ].map((step) => (
              <div
                key={step.eyebrow}
                className="rounded-md bg-neutral-50 px-5 py-[22px]"
              >
                <p className="mb-3 text-xs font-medium tracking-wider text-primary">
                  {step.eyebrow}
                </p>
                <h3 className="mb-1.5 text-[15px] font-medium text-neutral-900">
                  {step.title}
                </h3>
                <p className="text-[13px] leading-[1.55] text-neutral-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
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
