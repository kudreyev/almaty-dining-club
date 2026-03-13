import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'

type PageProps = { params: Promise<{ restaurantId: string }> }

export default async function AdminOffersForRestaurantPage({ params }: PageProps) {
  const { restaurantId } = await params
  const { supabase } = await requireAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .single()

  const { data: offers } = await supabase
    .from('offers')
    .select('id, offer_key, offer_type, offer_title, is_active')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{restaurant?.restaurant_name}</h1>
            <p className="mt-2 text-sm text-gray-600">Офферы</p>
          </div>
          <Link
            href={`/admin/offers/${restaurantId}/new`}
            className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            + Добавить оффер
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {offers?.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium">{o.offer_title}</p>
            
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {o.offer_type}
                  </span>
            
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {o.is_active ? 'active' : 'hidden'}
                  </span>
            
                  {o.offer_key ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-700">
                      {o.offer_key}
                    </span>
                  ) : null}
                </div>
              </div>
            
              <Link
                href={`/admin/offers/${restaurantId}/${o.id}/edit`}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Редактировать
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/admin/offers" className="text-sm text-gray-600 underline">← Все рестораны</Link>
        </div>
      </div>
    </main>
  )
}