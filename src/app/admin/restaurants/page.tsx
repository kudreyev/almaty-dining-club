import { requireAdmin } from '@/lib/admin'
import { logServerError } from '@/lib/safe-errors'
import { Button } from '@/components/ui/button'
import {
  AdminRestaurantsList,
  type AdminRestaurantRow,
} from '@/components/admin/restaurants-list'

export default async function AdminRestaurantsPage() {
  const { supabase, user } = await requireAdmin()

  const { data: restaurants, error: restaurantsError } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, slug, address, is_active, city')
    .order('restaurant_name', { ascending: true })
    .returns<AdminRestaurantRow[]>()

  if (restaurantsError) {
    logServerError('admin/restaurants', restaurantsError)
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Заведения</h1>
          <p className="mt-1 text-base leading-6 text-gray-500">Управление ресторанами</p>
        </div>
        <Button href="/admin/restaurants/new" size="sm">
          + Добавить
        </Button>
      </div>

      {process.env.NODE_ENV !== 'production' ? (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <p>
            debug: auth.uid={user.id} | role=admin | client=server-session-anon
          </p>
          <p>
            debug: restaurants_error={restaurantsError ? restaurantsError.message : 'none'}
          </p>
        </div>
      ) : null}

      {restaurantsError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Не удалось загрузить список заведений.
        </div>
      ) : null}

      {!restaurantsError && (!restaurants || restaurants.length === 0) ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Список пуст. Проверьте RLS policy на SELECT для admins и наличие записей в таблице
          `public.restaurants`.
        </div>
      ) : null}

      {!restaurantsError && restaurants && restaurants.length > 0 ? (
        <AdminRestaurantsList restaurants={restaurants} />
      ) : null}
    </div>
  )
}
