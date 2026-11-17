import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import { isCity, CITY_LABELS } from '@/lib/cities'
import { pageMetadata } from '@/lib/seo'
import { DEFAULT_TZ } from '@/lib/opening-hours'
import {
  formatEventEndsLabel,
  formatSetPrice,
  getSetServingStatus,
  isEventActiveNow,
  resolveSetSchedule,
  type EventVenueScheduleRow,
  type FestivalEvent,
} from '@/lib/events'
import { restaurant_is_club_partner_client } from '@/lib/events-catalog'
import { canViewFestivals, isFestivalAdminOnly } from '@/lib/festival-access'
import { FestivalVenuesClient } from '@/components/festival/festival-venues-client'

type PageProps = {
  params: Promise<{ city: string; eventSlug: string }>
}

const RESERVED = new Set(['map'])

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, eventSlug } = await params
  if (!isCity(city) || RESERVED.has(eventSlug)) return {}
  if (!(await canViewFestivals())) return {}

  const supabase = createSupabasePublicClient()
  const { data: event } = await supabase
    .from('events')
    .select('name, set_price_kzt, ends_at, is_published, starts_at')
    .eq('slug', eventSlug)
    .eq('city', city)
    .eq('is_published', true)
    .maybeSingle()

  if (!event) return { title: 'Фестиваль — KudaClub' }

  return pageMetadata({
    title: `${event.name} · сеты ${formatSetPrice(event.set_price_kzt)} | KudaClub`,
    description: `${event.name} в ${CITY_LABELS[city]}: сеты за ${formatSetPrice(event.set_price_kzt)} до ${formatEventEndsLabel(event.ends_at)}.`,
    path: `/${city}/${eventSlug}`,
  })
}

export default async function FestivalPage({ params }: PageProps) {
  const { city, eventSlug } = await params
  if (!isCity(city) || RESERVED.has(eventSlug)) notFound()
  if (!(await canViewFestivals())) notFound()

  const supabase = createSupabasePublicClient()
  const now = new Date()

  const { data: event } = await supabase
    .from('events')
    .select(
      'id, slug, name, city, starts_at, ends_at, set_price_kzt, logo_url, accent_color, is_published',
    )
    .eq('slug', eventSlug)
    .eq('city', city)
    .eq('is_published', true)
    .maybeSingle<FestivalEvent>()

  if (!event || !isEventActiveNow(event, now, DEFAULT_TZ)) notFound()

  const { data: setOffers } = await supabase
    .from('offers')
    .select(`
      id,
      restaurant_id,
      offer_title,
      price_kzt,
      estimated_value,
      items,
      restaurants!inner (
        id,
        restaurant_name,
        slug,
        address,
        cuisine,
        is_active
      )
    `)
    .eq('event_id', event.id)
    .eq('offer_type', 'set')
    .eq('is_active', true)
    .eq('restaurants.is_active', true)

  type OfferRow = {
    id: string
    restaurant_id: string
    offer_title: string
    price_kzt: number | null
    estimated_value: number | null
    items: unknown
    restaurants: {
      id: string
      restaurant_name: string
      slug: string
      address: string
      cuisine: string
      is_active: boolean
    }
  }

  const rows = (setOffers ?? []) as unknown as OfferRow[]
  const restaurantIds = [...new Set(rows.map((r) => r.restaurant_id))]

  const [{ data: schedule }, clubPartnerIds] = await Promise.all([
    restaurantIds.length
      ? supabase
          .from('event_venue_schedule')
          .select('restaurant_id, offer_id, weekday, open_time, close_time')
          .eq('event_id', event.id)
          .in('restaurant_id', restaurantIds)
      : Promise.resolve({ data: [] as Array<{
          restaurant_id: string
          offer_id: string | null
          weekday: number
          open_time: string
          close_time: string
        }> }),
    restaurant_is_club_partner_client(supabase, restaurantIds),
  ])

  const scheduleByRestaurant = new Map<string, EventVenueScheduleRow[]>()
  for (const row of schedule ?? []) {
    const list = scheduleByRestaurant.get(row.restaurant_id) ?? []
    list.push({
      weekday: row.weekday,
      open_time: row.open_time,
      close_time: row.close_time,
      offer_id: row.offer_id,
    })
    scheduleByRestaurant.set(row.restaurant_id, list)
  }

  // One card per restaurant (first set).
  const byRestaurant = new Map<string, OfferRow>()
  for (const row of rows) {
    if (!byRestaurant.has(row.restaurant_id)) byRestaurant.set(row.restaurant_id, row)
  }

  const venues = [...byRestaurant.values()].map((row) => {
    const scheduleRows = resolveSetSchedule(
      scheduleByRestaurant.get(row.restaurant_id) ?? [],
      null,
    )
    const status = getSetServingStatus(scheduleRows, now, DEFAULT_TZ)
    return {
      restaurantId: row.restaurant_id,
      slug: row.restaurants.slug,
      name: row.restaurants.restaurant_name,
      address: row.restaurants.address,
      cuisine: row.restaurants.cuisine,
      offerTitle: row.offer_title,
      priceKzt: row.price_kzt ?? event.set_price_kzt,
      isClubPartner: clubPartnerIds.has(row.restaurant_id),
      isServing: status.isServing,
      statusLabel: status.badgeLabel,
      nextOpenSortKey: status.nextOpenSortKey,
    }
  })

  venues.sort((a, b) => {
    if (a.isServing !== b.isServing) return a.isServing ? -1 : 1
    return a.nextOpenSortKey - b.nextOpenSortKey
  })

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <Link href={`/${city}`} className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Каталог {CITY_LABELS[city]}
      </Link>

      <header className="mt-4">
        {isFestivalAdminOnly() ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Превью для админов — обычные гости эту страницу не видят.
          </p>
        ) : null}
        <p
          className="inline-block rounded-md px-2.5 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: event.accent_color }}
        >
          Сеты {formatSetPrice(event.set_price_kzt)}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
          {event.name}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          до {formatEventEndsLabel(event.ends_at)} · {venues.length} заведений
        </p>
      </header>

      <FestivalVenuesClient
        venues={venues}
        accentColor={event.accent_color}
        eventName={event.name}
      />
    </div>
  )
}
