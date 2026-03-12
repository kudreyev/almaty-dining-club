import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { upsertRestaurantStaff } from './actions'

type Restaurant = {
  id: string
  restaurant_name: string
}

type StaffRow = {
  id: string
  restaurant_id: string
  staff_name: string
  pin_code: string
  is_active: boolean
}

export default async function AdminStaffPage() {
  const { supabase } = await requireAdmin()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .order('restaurant_name', { ascending: true })
    .returns<Restaurant[]>()

  const { data: staffRows } = await supabase
    .from('staff_users')
    .select('id, restaurant_id, staff_name, pin_code, is_active')
    .returns<StaffRow[]>()

  const staffByRestaurant = new Map<string, StaffRow>()
  staffRows?.forEach((s) => staffByRestaurant.set(s.restaurant_id, s))

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin · Staff PIN</h1>
            <p className="mt-2 text-sm text-gray-600">
              Один PIN на ресторан (для staff login).
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/admin/restaurants" className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black">
              Restaurants
            </Link>
            <Link href="/admin/offers" className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black">
              Offers
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {restaurants?.map((r) => {
            const staff = staffByRestaurant.get(r.id)

            return (
              <div key={r.id} className="rounded-3xl border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{r.restaurant_name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {staff ? 'PIN настроен' : 'PIN ещё не задан'}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {staff?.is_active ? 'active' : 'inactive'}
                  </span>
                </div>

                <form action={upsertRestaurantStaff} className="mt-6 space-y-4">
                  <input type="hidden" name="restaurant_id" value={r.id} />

                  <input
                    name="staff_name"
                    defaultValue={staff?.staff_name ?? 'Администратор'}
                    className="w-full rounded-2xl border px-4 py-3 text-sm"
                    placeholder="Название staff (например Администратор)"
                  />

                  <input
                    name="pin_code"
                    defaultValue={staff?.pin_code ?? ''}
                    className="w-full rounded-2xl border px-4 py-3 text-sm"
                    placeholder="PIN (4 цифры)"
                    required
                  />

                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" name="is_active" defaultChecked={staff ? staff.is_active : true} />
                    Активен
                  </label>

                  <button className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white">
                    Сохранить PIN
                  </button>
                </form>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}