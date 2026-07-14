import { requireAdmin } from '@/lib/admin'
import {
  OffersRestaurantList,
  type OffersRestaurantRow,
} from '@/components/admin/offers-restaurant-list'

export default async function AdminOffersPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, city')
    .order('restaurant_name', { ascending: true })
    .returns<OffersRestaurantRow[]>()

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Офферы</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">Выберите ресторан для управления офферами</p>
      </div>

      <OffersRestaurantList restaurants={restaurants ?? []} />
    </div>
  )
}
