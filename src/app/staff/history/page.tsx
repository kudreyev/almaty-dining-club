import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStaffSessionRestaurantId } from '@/lib/staff-session'
import { logoutStaff } from '../login/actions'

type Restaurant = {
  id: string
  restaurant_name: string
}

type StaffRedemption = {
  id: string
  redeemed_at: string
  user_id: string
  restaurants: {
    restaurant_name: string
  } | null
  offers: {
    offer_title: string
    offer_type: '2for1' | 'compliment'
  } | null
}

function getOfferTypeLabel(type: '2for1' | 'compliment') {
  if (type === '2for1') return '1+1'
  return 'Комплимент'
}

export default async function StaffHistoryPage() {
  const restaurantId = await getStaffSessionRestaurantId()

  if (!restaurantId) {
    redirect('/staff/login')
  }

  const supabase = await createSupabaseServerClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Restaurant>()

  if (!restaurant) {
    redirect('/staff/login')
  }

  const { data: redemptions, error } = await supabase
    .from('redemptions')
    .select(`
      id,
      redeemed_at,
      user_id,
      restaurants (
        restaurant_name
      ),
      offers (
        offer_title,
        offer_type
      )
    `)
    .eq('restaurant_id', restaurantId)
    .order('redeemed_at', { ascending: false })
    .limit(20)
    .returns<StaffRedemption[]>()

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold">История погашений</h1>
        <p className="mt-4 text-red-600">Ошибка: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">История погашений</h1>
            <p className="mt-3 text-gray-600">{restaurant.restaurant_name}</p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/staff/redeem"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Проверка кода
            </Link>

            <form action={logoutStaff}>
              <button
                type="submit"
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {!redemptions || redemptions.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Пока нет ни одного погашения.
            </div>
          ) : (
            redemptions.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Оффер</p>
                    <p className="font-medium">
                      {item.offers?.offer_title ?? '—'}
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {item.offers?.offer_type
                      ? getOfferTypeLabel(item.offers.offer_type)
                      : 'Оффер'}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-500">Дата</p>
                    <p className="font-medium">
                      {new Date(item.redeemed_at).toLocaleString('ru-RU')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">User ID</p>
                    <p className="break-all font-medium">{item.user_id}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}