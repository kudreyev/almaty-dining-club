import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import {
  updateEvent,
  addFestivalRestaurant,
  removeFestivalRestaurant,
} from '../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RestaurantCityField } from '@/components/admin/restaurant-city-field'
import { formatSetPrice } from '@/lib/events'
import type { City } from '@/lib/cities'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}

type SetOfferRow = {
  id: string
  restaurant_id: string
  offer_title: string
  price_kzt: number | null
  is_active: boolean
}

export default async function AdminEventEditPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const { supabase } = await requireAdmin()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  const [{ data: venueLinks }, { data: setOffers }, { data: restaurants }] =
    await Promise.all([
      supabase
        .from('event_venues')
        .select('restaurant_id, restaurants ( id, restaurant_name, slug )')
        .eq('event_id', id),
      supabase
        .from('offers')
        .select('id, restaurant_id, offer_title, price_kzt, is_active')
        .eq('event_id', id)
        .eq('offer_type', 'set')
        .order('created_at', { ascending: true })
        .returns<SetOfferRow[]>(),
      supabase
        .from('restaurants')
        .select('id, restaurant_name, slug, city')
        .eq('city', event.city)
        .eq('is_active', true)
        .order('restaurant_name', { ascending: true }),
    ])

  const setsByRestaurant = new Map<string, SetOfferRow[]>()
  for (const offer of setOffers ?? []) {
    const list = setsByRestaurant.get(offer.restaurant_id) ?? []
    list.push(offer)
    setsByRestaurant.set(offer.restaurant_id, list)
  }

  const linkedIds = new Set((venueLinks ?? []).map((v) => v.restaurant_id))
  const availableRestaurants = (restaurants ?? []).filter((r) => !linkedIds.has(r.id))

  const venues = (venueLinks ?? [])
    .map((link) => {
      const rest = link.restaurants as
        | { id: string; restaurant_name: string; slug: string }
        | { id: string; restaurant_name: string; slug: string }[]
        | null
      const restaurant = Array.isArray(rest) ? rest[0] : rest
      if (!restaurant) return null
      return {
        id: restaurant.id,
        name: restaurant.restaurant_name,
        slug: restaurant.slug,
        sets: setsByRestaurant.get(restaurant.id) ?? [],
      }
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-4">
        <Button href="/admin/events" variant="ghost" size="sm">
          ← Фестивали
        </Button>
      </div>

      <Card padding="lg" className="space-y-4">
        <h1 className="text-xl font-bold">{event.name}</h1>
        <p className="text-sm text-gray-500">
          Сначала сохраните фестиваль, затем добавьте заведения и прикрепите сеты.
        </p>
        {sp.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {sp.error}
          </div>
        ) : null}
        <form action={updateEvent} className="space-y-4">
          <input type="hidden" name="id" value={event.id} />
          <Input name="name" label="Название" defaultValue={event.name} required />
          <Input name="slug" label="Slug" defaultValue={event.slug} required />
          <RestaurantCityField defaultCity={event.city as City} />
          <Input name="starts_at" type="date" label="Начало" defaultValue={event.starts_at} required />
          <Input name="ends_at" type="date" label="Конец" defaultValue={event.ends_at} required />
          <Input
            name="set_price_kzt"
            type="number"
            label="Цена сета по умолчанию, ₸"
            defaultValue={event.set_price_kzt}
            required
          />
          <Input name="accent_color" label="Accent" defaultValue={event.accent_color} />
          <Input
            name="max_sets_per_venue_per_day"
            type="number"
            label="Лимит сетов / день"
            defaultValue={event.max_sets_per_venue_per_day}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={!!event.is_published}
              className="rounded"
            />
            Опубликован
          </label>
          <Button type="submit">Сохранить фестиваль</Button>
        </form>
      </Card>

      <Card padding="lg" className="mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Заведения</h2>
          <p className="mt-1 text-sm text-gray-500">
            Площадка может быть без сета — прикрепите сет позже.
          </p>
        </div>

        {venues.length === 0 ? (
          <p className="text-sm text-gray-400">Пока нет заведений в этом фестивале.</p>
        ) : (
          <ul className="space-y-2">
            {venues.map((venue) => {
              const hasSets = venue.sets.length > 0
              return (
                <li
                  key={venue.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    <p className="text-xs text-gray-500">
                      {hasSets
                        ? venue.sets
                            .map(
                              (s) =>
                                `${s.offer_title} (${formatSetPrice(s.price_kzt ?? event.set_price_kzt)})`,
                            )
                            .join(', ')
                        : 'сет ещё не прикреплён'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      href={`/admin/events/${event.id}/venues/${venue.id}`}
                      variant="secondary"
                      size="sm"
                    >
                      {hasSets ? 'Сеты и расписание' : 'Сет и расписание'}
                    </Button>
                    {!hasSets ? (
                      <form action={removeFestivalRestaurant}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="restaurant_id" value={venue.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Убрать
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <form action={addFestivalRestaurant} className="space-y-3 border-t border-gray-100 pt-4">
          <input type="hidden" name="event_id" value={event.id} />
          <h3 className="font-medium">Добавить заведение</h3>
          <label className="block text-sm text-gray-600">
            Существующее
            <select
              name="restaurant_id"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
              defaultValue=""
            >
              <option value="">— новое ниже —</option>
              {availableRestaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.restaurant_name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-gray-400">Или создайте «только фестиваль»:</p>
          <Input name="new_restaurant_name" label="Название нового" />
          <Input name="new_restaurant_slug" label="Slug нового" />
          <Input name="new_restaurant_address" label="Адрес" />
          <Input name="new_restaurant_cuisine" label="Кухня" defaultValue="Кофейня" />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="combine_set_with_club_offer" className="rounded" />
            Сет + 1+1 в один визит
          </label>
          <Button type="submit" variant="secondary">
            Добавить заведение
          </Button>
        </form>
      </Card>
    </div>
  )
}
