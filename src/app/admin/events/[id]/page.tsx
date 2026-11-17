import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { updateEvent, addFestivalRestaurant } from '../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RestaurantCityField } from '@/components/admin/restaurant-city-field'
import { formatSetPrice } from '@/lib/events'
import type { City } from '@/lib/cities'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminEventEditPage({ params }: PageProps) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  const [{ data: setOffers }, { data: restaurants }] = await Promise.all([
    supabase
      .from('offers')
      .select('id, restaurant_id, offer_title, price_kzt, is_active, restaurants ( restaurant_name, slug )')
      .eq('event_id', id)
      .eq('offer_type', 'set')
      .order('created_at', { ascending: true }),
    supabase
      .from('restaurants')
      .select('id, restaurant_name, slug, city')
      .eq('city', event.city)
      .eq('is_active', true)
      .order('restaurant_name', { ascending: true }),
  ])

  const venuesMap = new Map<
    string,
    { id: string; name: string; slug: string; sets: typeof setOffers }
  >()
  for (const offer of setOffers ?? []) {
    const rest = offer.restaurants as { restaurant_name: string; slug: string } | null
    if (!venuesMap.has(offer.restaurant_id)) {
      venuesMap.set(offer.restaurant_id, {
        id: offer.restaurant_id,
        name: rest?.restaurant_name ?? offer.restaurant_id,
        slug: rest?.slug ?? '',
        sets: [],
      })
    }
    venuesMap.get(offer.restaurant_id)!.sets!.push(offer)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-4">
        <Button href="/admin/events" variant="ghost" size="sm">
          ← Фестивали
        </Button>
      </div>

      <Card padding="lg" className="space-y-4">
        <h1 className="text-xl font-bold">{event.name}</h1>
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
            label="Цена сета, ₸"
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
        <h2 className="text-lg font-semibold">Заведения со сетами</h2>
        <ul className="space-y-2">
          {[...venuesMap.values()].map((venue) => (
            <li key={venue.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
              <div>
                <p className="font-medium">{venue.name}</p>
                <p className="text-xs text-gray-500">
                  {(venue.sets ?? [])
                    .map((s) => `${s.offer_title} (${formatSetPrice(s.price_kzt ?? event.set_price_kzt)})`)
                    .join(', ') || 'нет сетов'}
                </p>
              </div>
              <Button
                href={`/admin/events/${event.id}/venues/${venue.id}`}
                variant="secondary"
                size="sm"
              >
                Сеты и расписание
              </Button>
            </li>
          ))}
        </ul>

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
              {(restaurants ?? []).map((r) => (
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
            Добавить и настроить
          </Button>
        </form>
      </Card>
    </div>
  )
}
