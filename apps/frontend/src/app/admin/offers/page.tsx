import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { Card } from '@/components/ui/card'

export default async function AdminOffersPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .order('restaurant_name', { ascending: true })

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Офферы</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">Выберите ресторан для управления офферами</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {restaurants?.map((r) => (
          <Link key={r.id} href={`/admin/offers/${r.id}`}>
            <Card hover padding="md" className="h-full">
              <p className="font-semibold">{r.restaurant_name}</p>
              <p className="mt-1 text-sm text-gray-400">Управлять офферами →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
