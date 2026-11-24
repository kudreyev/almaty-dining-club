import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import {
  saveFestivalSet,
  saveFestivalVenueSchedule,
  deleteFestivalSet,
} from '../../../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatSetPrice } from '@/lib/events'
import {
  EventScheduleFields,
  type ScheduleDayState,
} from '@/components/admin/event-schedule-fields'

type PageProps = {
  params: Promise<{ id: string; restaurantId: string }>
  searchParams: Promise<{ set?: string; new?: string; error?: string; ok?: string }>
}

type SetRow = {
  id: string
  offer_title: string
  offer_terms_short: string | null
  price_kzt: number | null
  menu_value_kzt: number | null
  items: unknown
  is_active: boolean
}

export default async function AdminEventVenuePage({ params, searchParams }: PageProps) {
  const { id: eventId, restaurantId } = await params
  const sp = await searchParams
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
        .order('created_at', { ascending: true })
        .returns<SetRow[]>(),
      supabase
        .from('event_venue_schedule')
        .select('weekday, open_time, close_time, offer_id')
        .eq('event_id', eventId)
        .eq('restaurant_id', restaurantId)
        .is('offer_id', null),
    ])

  if (!event || !restaurant) notFound()

  const setList = sets ?? []
  // Редактируем только если явно выбрали ?set=id. Иначе форма всегда создаёт новый сет.
  const editing = sp.set ? setList.find((s) => s.id === sp.set) ?? null : null

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

  const nextSetNumber = setList.length + 1
  const itemsJson = editing?.items
    ? JSON.stringify(editing.items, null, 2)
    : '[\n  {"title":"Тост с авокадо"},\n  {"title":"Напиток на выбор","options":["латте","капучино"]}\n]'

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-4">
        <Button href={`/admin/events/${eventId}`} variant="ghost" size="sm">
          ← {event.name}
        </Button>
      </div>

      <h1 className="mb-2 text-xl font-bold">{restaurant.restaurant_name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        У площадки свои дни/часы подачи и свои сеты (можно несколько разных).
      </p>

      {sp.error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {sp.error}
        </div>
      ) : null}

      {sp.ok === '1' ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Сет сохранён.
        </div>
      ) : null}

      <Card padding="lg" className="space-y-4">
        <h2 className="text-lg font-semibold">Расписание подачи сета</h2>
        <p className="text-sm text-gray-500">
          Дни и часы именно для фестиваля — можно задать отдельно от обычного
          времени работы заведения. Действует на все сеты этой площадки.
        </p>
        <form action={saveFestivalVenueSchedule} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <EventScheduleFields initial={initialSchedule} />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              name="combine_set_with_club_offer"
              defaultChecked={!!restaurant.combine_set_with_club_offer}
              className="rounded"
            />
            Сет + 1+1 в один визит
          </label>
          <Button type="submit" variant="secondary" className="w-full">
            Сохранить расписание
          </Button>
        </form>
      </Card>

      <Card padding="lg" className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">Сеты ({setList.length})</h2>

        {setList.length === 0 ? (
          <p className="text-sm text-gray-400">Пока нет сетов — добавьте первый ниже.</p>
        ) : (
          <ul className="space-y-2">
            {setList.map((set, index) => {
              const active = editing?.id === set.id
              return (
                <li
                  key={set.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                    active ? 'border-gray-300 bg-gray-50' : 'border-gray-100'
                  }`}
                >
                  <div>
                    <p className="font-medium">
                      {set.offer_title}
                      {!set.is_active ? (
                        <span className="ml-2 text-xs font-normal text-gray-400">выкл</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatSetPrice(set.price_kzt ?? event.set_price_kzt)}
                      {setList.length > 1 ? ` · №${index + 1}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      href={`/admin/events/${eventId}/venues/${restaurantId}?set=${set.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      Изменить
                    </Button>
                    <form action={deleteFestivalSet}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="restaurant_id" value={restaurantId} />
                      <input type="hidden" name="offer_id" value={set.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Удалить
                      </Button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {editing ? (
          <Button
            href={`/admin/events/${eventId}/venues/${restaurantId}`}
            variant="secondary"
            size="sm"
          >
            + Новый сет
          </Button>
        ) : null}
      </Card>

      <Card padding="lg" className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {editing ? 'Редактировать сет' : 'Добавить сет'}
        </h2>
        <p className="text-sm text-gray-500">
          {editing
            ? 'Сохраняет изменения выбранного сета.'
            : 'Форма создаёт новый сет. Чтобы править существующий — нажмите «Изменить» в списке.'}
        </p>
        <form action={saveFestivalSet} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          {editing ? <input type="hidden" name="offer_id" value={editing.id} /> : null}

          <Input
            name="offer_title"
            label="Название сета"
            defaultValue={editing?.offer_title ?? `Сет №${nextSetNumber}`}
            required
          />
          <Input
            name="offer_terms_short"
            label="Краткое описание"
            defaultValue={editing?.offer_terms_short ?? ''}
          />
          <Input
            name="price_kzt"
            type="number"
            label="Цена для гостя, ₸"
            defaultValue={editing?.price_kzt ?? event.set_price_kzt}
            required
          />
          <Input
            name="menu_value_kzt"
            type="number"
            label="Цена по меню (для выгоды), ₸"
            defaultValue={
              editing?.menu_value_kzt
              ?? (editing?.price_kzt ?? event.set_price_kzt) + 2000
            }
            required
          />
          <label className="block text-sm text-gray-600">
            Состав (JSON, необязательно)
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
              defaultChecked={editing ? !!editing.is_active : true}
              className="rounded"
            />
            Сет активен
          </label>

          <Button type="submit" className="w-full">
            {editing ? 'Сохранить изменения' : 'Добавить сет'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
