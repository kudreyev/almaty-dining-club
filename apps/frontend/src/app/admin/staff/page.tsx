import { requireAdmin } from '@/lib/admin'
import { staffPinStatusLabel } from '@/lib/labels'
import { upsertRestaurantStaff } from './actions'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">PIN персонала</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">Один PIN на ресторан для входа персонала.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {restaurants?.map((r) => {
          const staff = staffByRestaurant.get(r.id)
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.restaurant_name}</p>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {staff ? 'PIN настроен' : 'PIN не задан'}
                  </p>
                </div>
                <Badge color={staff?.is_active ? 'green' : 'default'}>
                  {staff ? staffPinStatusLabel(!!staff.is_active) : 'Не задан'}
                </Badge>
              </div>

              <form action={upsertRestaurantStaff} className="mt-4 space-y-3">
                <input type="hidden" name="restaurant_id" value={r.id} />
                <Input
                  name="staff_name"
                  defaultValue={staff?.staff_name ?? 'Администратор'}
                  placeholder="Имя в системе"
                />
                <Input
                  name="pin_code"
                  defaultValue={staff?.pin_code ?? ''}
                  placeholder="PIN (4 цифры)"
                  required
                />
                <label className="flex items-center gap-2 text-base text-gray-600">
                  <input type="checkbox" name="is_active" defaultChecked={staff ? staff.is_active : true} className="rounded" />
                  Активен
                </label>
                <Button type="submit" size="sm" className="w-full">
                  Сохранить
                </Button>
              </form>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
