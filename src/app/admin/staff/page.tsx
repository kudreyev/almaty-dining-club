import { requireAdmin } from '@/lib/admin'
import {
  StaffRestaurantList,
  type StaffRestaurantRow,
  type StaffRow,
} from '@/components/admin/staff-restaurant-list'

export default async function AdminStaffPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, city')
    .order('restaurant_name', { ascending: true })
    .returns<StaffRestaurantRow[]>()

  const { data: staffRows } = await supabase
    .from('staff_users')
    .select('id, restaurant_id, staff_name, pin_code, is_active')
    .returns<StaffRow[]>()

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">PIN персонала</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">Один PIN на ресторан для входа персонала.</p>
      </div>

      <StaffRestaurantList restaurants={restaurants ?? []} staff={staffRows ?? []} />
    </div>
  )
}
