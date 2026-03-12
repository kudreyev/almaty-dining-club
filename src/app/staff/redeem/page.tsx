import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStaffSessionRestaurantId } from '@/lib/staff-session'
import { logoutStaff } from '../login/actions'
import { redeemTokenByCode } from './actions'

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
    case 'missing_code':
      return 'Введите код.'
    case 'not_found':
      return 'Код не найден.'
    case 'already_used':
      return 'Этот код уже использован.'
    case 'expired':
      return 'Срок действия кода истёк.'
    case 'update_failed':
      return 'Не удалось обновить токен.'
    case 'redemption_failed':
      return 'Не удалось записать погашение.'
    default:
      return null
  }
}

export default async function StaffRedeemPage({ searchParams }: PageProps) {
  const { error, success } = await searchParams
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

  const errorMessage = getErrorMessage(error)

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
       <div className="flex items-start justify-between gap-4">
         <div>
           <h1 className="text-3xl font-semibold">Проверка кода</h1>
           <p className="mt-3 text-gray-600">
             {restaurant.restaurant_name}
           </p>
         </div>

         <div className="flex gap-3">
           <a
             href="/staff/history"
             className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
           >
             История
           </a>

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

        {success ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Код {success} успешно погашен.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={redeemTokenByCode} className="mt-8 space-y-4">
          <div>
            <label htmlFor="tokenCode" className="mb-2 block text-sm font-medium text-gray-700">
              Код гостя
            </label>
            <input
              id="tokenCode"
              name="tokenCode"
              type="text"
              required
              placeholder="Например 482193"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm tracking-[0.15em] outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
          >
            Погасить код
          </button>
        </form>
      </div>
    </main>
  )
}