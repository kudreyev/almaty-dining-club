export const revalidate = 300
import Link from 'next/link'
import Image from 'next/image'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatOfferHeadline } from '@/lib/offers'
import { DEFAULT_TZ, computeOpenStatus, type RestaurantHour } from '@/lib/opening-hours'

type Offer = {
  id: string
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
  short_description: string
  cover_photo_url?: string | null
  offers: Offer[]
  restaurant_hours?: RestaurantHour[]
}

type PageProps = {
  searchParams: Promise<{
    q?: string
    offer?: string
    openNow?: string
  }>
}

function almatyQuery(params: Record<string, string>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== 'all') u.set(k, v)
  }
  const qs = u.toString()
  return qs ? `/almaty?${qs}` : '/almaty'
}

export default async function AlmatyPage({ searchParams }: PageProps) {
  const { q = '', offer = 'all', openNow: openNowRaw = '0' } = await searchParams
  const openNow = openNowRaw === '1'
  const supabase = await createSupabaseServerClient()
  const now = new Date()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(`
      id, restaurant_name, slug, address,
      cuisine, cuisine_2, cuisine_3,
      short_description,
      offers ( id, offer_type, offer_title, offer_terms_short, estimated_value, cooldown_days, is_active ),
      restaurant_hours ( day_of_week, is_closed, open_time, close_time, close_next_day )
    `)
    .eq('city', 'almaty')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">Заведения Алматы</h1>
        <p className="mt-4 text-base text-red-600">Ошибка: {error.message}</p>
      </div>
    )
  }

  const normalizedQuery = q.trim().toLowerCase()
  const safeRestaurants = (restaurants as Restaurant[]) ?? []
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

  const filteredRestaurants = restaurantsWithStatus.filter((restaurant) => {
    const matchesQuery =
      !normalizedQuery ||
      restaurant.restaurant_name.toLowerCase().includes(normalizedQuery) ||
      [restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
        .filter(Boolean)
        .some((c) => c!.toLowerCase().includes(normalizedQuery))

    const activeOffers = (restaurant.offers || []).filter((item) => item.is_active)
    const matchesOffer = offer === 'all' || activeOffers.some((item) => item.offer_type === offer)
    const matchesOpenNow = !openNow || restaurant.openStatus.isOpen

    return matchesQuery && matchesOffer && matchesOpenNow
  })

  const chips = [
    {
      label: '2за1',
      href: almatyQuery({
        q,
        offer: offer === '2for1' ? '' : '2for1',
        openNow: openNow ? '1' : '',
      }),
      isActive: offer === '2for1',
    },
    {
      label: 'В подарок',
      href: almatyQuery({
        q,
        offer: offer === 'compliment' ? '' : 'compliment',
        openNow: openNow ? '1' : '',
      }),
      isActive: offer === 'compliment',
    },
    {
      label: 'Открыто сейчас',
      href: almatyQuery({
        q,
        offer,
        openNow: openNow ? '' : '1',
      }),
      isActive: openNow,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Заведения Алматы</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">Партнёры с офферами 2за1 и в подарок.</p>
      </div>

      <div className="mb-6 flex items-baseline justify-between">
        <p className="text-base text-gray-400">{filteredRestaurants.length} шт.</p>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Link
            key={`${chip.label}-${chip.href}`}
            href={chip.href}
            scroll={false}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              chip.isActive
                ? 'bg-black text-white'
                : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {filteredRestaurants.length === 0 ? (
        <EmptyState title="Ничего не найдено" description="Попробуйте другой запрос" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRestaurants.map((restaurant) => {
            const activeOffers = (restaurant.offers || []).filter((item) => item.is_active)

            return (
              <Link
                key={restaurant.id}
                href={`/r/${restaurant.slug}`}
                className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  {restaurant.cover_photo_url ? (
                    <Image
                      src={restaurant.cover_photo_url}
                      alt={restaurant.restaurant_name}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, 400px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-base text-gray-300">
                      Нет фото
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="text-lg font-semibold leading-snug sm:text-xl">{restaurant.restaurant_name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[restaurant.cuisine, restaurant.cuisine_2, restaurant.cuisine_3]
                      .filter(Boolean)
                      .slice(0, 3)
                      .map((c) => (
                        <Badge key={c as string}>{c as string}</Badge>
                      ))}
                  </div>

                  <p className={`mt-2 text-sm ${restaurant.openStatus.isOpen ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {restaurant.openStatus.isOpen
                      ? (restaurant.openStatus.labelDetail
                          ? `Открыто · ${restaurant.openStatus.labelDetail.replace('Работает до ', 'до ')}`
                          : 'Открыто')
                      : (restaurant.openStatus.labelDetail
                          ? `Закрыто · ${restaurant.openStatus.labelDetail.charAt(0).toLowerCase()}${restaurant.openStatus.labelDetail.slice(1)}`
                          : 'Закрыто')}
                  </p>

                  {activeOffers.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {activeOffers.slice(0, 3).map((o, i) => (
                        <span
                          key={`${restaurant.id}-offer-${i}`}
                          className="inline-flex max-w-full shrink-0 items-center rounded-full bg-black px-3 py-1 text-sm font-medium text-white"
                        >
                          <span className="truncate">{formatOfferHeadline(o.offer_type, o.offer_title)}</span>
                        </span>
                      ))}
                      {activeOffers.length > 3 ? (
                        <span className="text-sm text-gray-400">и ещё {activeOffers.length - 3}</span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-3 text-base leading-6 text-gray-500 line-clamp-2">
                    {restaurant.short_description}
                  </p>

                  <p className="mt-2 truncate text-sm text-gray-400">{restaurant.address}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
