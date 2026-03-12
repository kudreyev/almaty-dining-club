import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'

export default async function AdminRestaurantsPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, slug, district, is_active')
    .order('restaurant_name', { ascending: true })

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin · Restaurants</h1>
            <p className="mt-2 text-sm text-gray-600">Управление заведениями</p>
          </div>
          <Link href="/admin/restaurants/new" className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white">
            + Добавить
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {restaurants?.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-medium">{r.restaurant_name}</p>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {r.is_active ? 'active' : 'hidden'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{r.district} · {r.slug}</p>
              </div>
              <Link href={`/admin/restaurants/${r.id}/edit`} className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black">
                Редактировать
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}