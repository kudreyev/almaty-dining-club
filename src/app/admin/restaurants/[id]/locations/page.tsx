import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { addLocation, deleteLocation } from './actions'

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
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Адреса</h1>
            <p className="mt-2 text-sm text-gray-600">{restaurant.restaurant_name}</p>
            <p className="mt-1 text-xs text-gray-500">/r/{restaurant.slug}</p>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/admin/restaurants/${id}/edit`}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Редактировать ресторан
            </Link>

            <Link
              href="/admin/restaurants"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Список
            </Link>
          </div>
        </div>

        {ok ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Готово ✅
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Ошибка: {error}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl bg-gray-50 p-5">
          <p className="text-sm font-semibold text-gray-900">Добавить адрес</p>

          <form action={addLocation} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="restaurantId" value={id} />
            <input
              name="address"
              placeholder="Например: пр. Абая 120, Алматы"
              required
              className="w-full flex-1 rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
            <button className="rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white">
              Добавить
            </button>
          </form>

          <p className="mt-3 text-xs text-gray-500">
            Пока добавляем только адрес (без отдельного телефона/часов для филиала).
          </p>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-gray-900">Текущие адреса</p>

          {!locations || locations.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Адресов пока нет.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 p-4"
                >
                  <p className="text-sm text-gray-800">{loc.address}</p>

                  <form action={deleteLocation}>
                    <input type="hidden" name="restaurantId" value={id} />
                    <input type="hidden" name="locationId" value={loc.id} />
                    <button
                      type="submit"
                      className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
                    >
                      Удалить
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}