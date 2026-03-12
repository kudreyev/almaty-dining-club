import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'

export default async function AdminOffersPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .order('restaurant_name', { ascending: true })

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Admin · Offers</h1>
        <p className="mt-2 text-sm text-gray-600">Выберите ресторан, чтобы управлять офферами</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants?.map((r) => (
            <Link
              key={r.id}
              href={`/admin/offers/${r.id}`}
              className="rounded-2xl border border-gray-200 p-5 hover:bg-gray-50"
            >
              <p className="font-medium">{r.restaurant_name}</p>
              <p className="mt-1 text-sm text-gray-500">Управлять офферами</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}