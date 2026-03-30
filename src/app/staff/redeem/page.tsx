import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStaffSessionRestaurantId } from '@/lib/staff-session'
import { logoutStaff } from '../login/actions'
import { redeemTokenByCode } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Restaurant = {
  id: string
  restaurant_name: string
}

type PageProps = {
  searchParams: Promise<{
    error?: string
    success?: string
  }>
}

function getErrorMessage(error?: string) {
  switch (error) {
    case 'missing_code': return 'Введите код.'
    case 'not_found': return 'Код не найден.'
    case 'already_used': return 'Этот код уже использован.'
    case 'expired': return 'Срок действия кода истёк.'
    case 'update_failed': return 'Не удалось обновить токен.'
    case 'redemption_failed': return 'Не удалось записать погашение.'
    default: return null
  }
}

export default async function StaffRedeemPage({ searchParams }: PageProps) {
  const { error, success } = await searchParams
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

  const errorMessage = getErrorMessage(error)

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-sm" padding="lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Проверка кода</h1>
            <p className="mt-1 text-sm text-gray-500">{restaurant.restaurant_name}</p>
          </div>
          <div className="flex gap-1">
            <Button href="/staff/history" variant="ghost" size="sm">История</Button>
            <form action={logoutStaff}>
              <Button type="submit" variant="ghost" size="sm">Выйти</Button>
            </form>
          </div>
        </div>

        {success ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Код {success} погашен.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={redeemTokenByCode} className="mt-6 space-y-4">
          <Input
            id="tokenCode"
            name="tokenCode"
            type="text"
            label="Код гостя"
            required
            placeholder="482193"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm tracking-[0.2em] outline-none transition-colors focus:border-brand"
          />
          <Button type="submit" className="w-full">
            Погасить код
          </Button>
        </form>
      </Card>
    </div>
  )
}
