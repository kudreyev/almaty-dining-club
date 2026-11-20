import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { saveFestivalSet } from '../../../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  EventScheduleFields,
  type ScheduleDayState,
} from '@/components/admin/event-schedule-fields'

type PageProps = {
  params: Promise<{ id: string; restaurantId: string }>
}

export default async function AdminEventVenuePage({ params }: PageProps) {
  const { id: eventId, restaurantId } = await params
  const { supabase } = await requireAdmin()

  const [{ data: event }, { data: restaurant }, { data: sets }, { data: schedule }] =
    await Promise.all([
      supabase.from('events').select('id, name, set_price_kzt').eq('id', eventId).maybeSingle(),
      supabase
        .from('restaurants')
        .select('id, restaurant_name, combine_set_with_club_offer')
        .eq('id', restaurantId)
        .maybeSingle(),
      supabase
        .from('offers')
        .select('id, offer_title, offer_terms_short, price_kzt, menu_value_kzt, items, is_active')
        .eq('event_id', eventId)
        .eq('restaurant_id', restaurantId)
        .eq('offer_type', 'set')
        .order('created_at', { ascending: true }),
      supabase
        .from('event_venue_schedule')
        .select('weekday, open_time, close_time, offer_id')
        .eq('event_id', eventId)
        .eq('restaurant_id', restaurantId)
        .is('offer_id', null),
    ])

  if (!event || !restaurant) notFound()

  const initialSchedule: Partial<Record<number, ScheduleDayState>> = {}
  for (const row of schedule ?? []) {
    const existing = initialSchedule[row.weekday]
    if (!existing || existing.closed) {
      initialSchedule[row.weekday] = {
        closed: false,
        open: String(row.open_time).slice(0, 5),
        close: String(row.close_time).slice(0, 5),
        open2: '',
        close2: '',
      }
    } else if (!existing.open2) {
      existing.open2 = String(row.open_time).slice(0, 5)
      existing.close2 = String(row.close_time).slice(0, 5)
    }
  }

  const primary = sets?.[0] ?? null
  const itemsJson = primary?.items
    ? JSON.stringify(primary.items, null, 2)
    : '[\n  {"title":"Тост с авокадо"},\n  {"title":"Напиток на выбор","options":["латте","капучино"]}\n]'

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-4">
        <Button href={`/admin/events/${eventId}`} variant="ghost" size="sm">
          ← {event.name}
        </Button>
      </div>

      <Card padding="lg" className="space-y-4">
        <h1 className="text-xl font-bold">{restaurant.restaurant_name}</h1>
        <p className="text-sm text-gray-500">
          {primary ? 'Редактирование сета' : 'Прикрепить сет'} · {event.name}
        </p>

        <form action={saveFestivalSet} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          {primary ? <input type="hidden" name="offer_id" value={primary.id} /> : null}

          <Input
            name="offer_title"
            label="Название сета"
            defaultValue={primary?.offer_title ?? 'Сет №1'}
            required
          />
          <Input
            name="offer_terms_short"
            label="Краткое описание"
            defaultValue={primary?.offer_terms_short ?? ''}
          />
          <Input
            name="price_kzt"
            type="number"
            label="Цена для гостя, ₸"
            defaultValue={primary?.price_kzt ?? event.set_price_kzt}
            required
          />
          <Input
            name="menu_value_kzt"
            type="number"
            label="Цена по меню (для выгоды), ₸"
            defaultValue={
              primary?.menu_value_kzt
              ?? (primary?.price_kzt ?? event.set_price_kzt) + 2000
            }
            required
          />
          <label className="block text-sm text-gray-600">
            Состав (JSON)
            <textarea
              name="items_json"
              rows={6}
              defaultValue={itemsJson}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={primary ? !!primary.is_active : true}
              className="rounded"
            />
            Сет активен
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              name="combine_set_with_club_offer"
              defaultChecked={!!restaurant.combine_set_with_club_offer}
              className="rounded"
            />
            Сет + 1+1 в один визит
          </label>

          <div>
            <h2 className="mb-2 text-base font-medium">Расписание подачи</h2>
            <EventScheduleFields initial={initialSchedule} />
          </div>

          <Button type="submit" className="w-full">
            {primary ? 'Сохранить сет и расписание' : 'Прикрепить сет'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
