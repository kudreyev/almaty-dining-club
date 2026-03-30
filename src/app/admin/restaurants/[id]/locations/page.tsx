import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { addLocation, deleteLocation } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; error?: string }>
}

type Location = {
  id: string
  address: string
}

export default async function AdminRestaurantLocationsPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { ok, error } = await searchParams
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, slug')
    .eq('id', id)
    .single()

  if (!restaurant) notFound()

  const { data: locations } = await supabase
    .from('restaurant_locations')
    .select('id, address')
    .eq('restaurant_id', id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<Location[]>()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Адреса</h1>
          <p className="text-sm text-gray-500">{restaurant.restaurant_name}</p>
        </div>
        <div className="flex gap-2">
          <Button href={`/admin/restaurants/${id}/edit`} variant="secondary" size="sm">Ресторан</Button>
          <Button href="/admin/restaurants" variant="ghost" size="sm">← Список</Button>
        </div>
      </div>

      {ok ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Готово
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Ошибка: {error}
        </div>
      ) : null}

      <Card className="mb-6">
        <p className="text-sm font-medium">Добавить адрес</p>
        <form action={addLocation} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="restaurantId" value={id} />
          <div className="flex-1">
            <Input name="address" placeholder="пр. Абая 120, Алматы" required />
          </div>
          <Button type="submit" size="md">Добавить</Button>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-medium">Текущие адреса</h2>

      {!locations || locations.length === 0 ? (
        <EmptyState title="Адресов пока нет" description="Добавьте первый адрес выше" />
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <Card key={loc.id} padding="sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">{loc.address}</p>
                <form action={deleteLocation}>
                  <input type="hidden" name="restaurantId" value={id} />
                  <input type="hidden" name="locationId" value={loc.id} />
                  <Button type="submit" variant="ghost" size="sm">Удалить</Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
