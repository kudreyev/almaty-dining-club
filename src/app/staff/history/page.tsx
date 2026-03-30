import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStaffSessionRestaurantId } from '@/lib/staff-session'
import { logoutStaff } from '../login/actions'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

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

export default async function StaffHistoryPage() {
  const restaurantId = await getStaffSessionRestaurantId()
  if (!restaurantId) redirect('/staff/login')

  const supabase = await createSupabaseServerClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Restaurant>()

  if (!restaurant) redirect('/staff/login')

  const { data: redemptions, error } = await supabase
    .from('redemptions')
    .select(`
      id, redeemed_at, user_id,
      restaurants ( restaurant_name ),
      offers ( offer_title, offer_type )
    `)
    .eq('restaurant_id', restaurantId)
    .order('redeemed_at', { ascending: false })
    .limit(20)
    .returns<StaffRedemption[]>()

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-xl font-bold">История погашений</h1>
        <p className="mt-4 text-sm text-red-600">Ошибка: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">История погашений</h1>
          <p className="text-sm text-gray-500">{restaurant.restaurant_name}</p>
        </div>
        <div className="flex gap-2">
          <Button href="/staff/redeem" variant="secondary" size="sm">
            Проверка кода
          </Button>
          <form action={logoutStaff}>
            <Button type="submit" variant="ghost" size="sm">
              Выйти
            </Button>
          </form>
        </div>
      </div>

      {!redemptions || redemptions.length === 0 ? (
        <EmptyState title="Нет погашений" description="Первое погашение появится здесь" />
      ) : (
        <div className="space-y-3">
          {redemptions.map((item) => (
            <Card key={item.id} padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.offers?.offer_title ?? '—'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    ID: {item.user_id.slice(0, 8)}...
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge color={item.offers?.offer_type === '2for1' ? 'dark' : 'blue'}>
                    {item.offers?.offer_type === '2for1' ? '1+1' : 'Комплимент'}
                  </Badge>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(item.redeemed_at).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
