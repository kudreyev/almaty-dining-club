import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loginStaff } from './actions'

type Restaurant = {
  id: string
  restaurant_name: string
}

type PageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

function getErrorMessage(error?: string, message?: string) {
  if (error === 'invalid_pin') {
    return 'Неверный PIN для выбранного ресторана.'
  }
  if (error === 'missing_fields') {
    return 'Заполните все поля.'
  }
  if (error === 'no_staff_for_restaurant') {
    return 'Для выбранного ресторана не найден staff-аккаунт.'
  }
  if (error === 'db_error') {
    return `Ошибка базы данных: ${message || 'неизвестно'}`
  }
  return null
}

export default async function StaffLoginPage({ searchParams }: PageProps) {
  const { error, message } = await searchParams
  const errorMessage = getErrorMessage(error, message)

  const supabase = await createSupabaseServerClient()
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('is_active', true)
    .order('restaurant_name', { ascending: true })
    .returns<Restaurant[]>()

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Staff Login</h1>
        <p className="mt-3 text-gray-600">
          Войдите по PIN, чтобы проверять и погашать коды гостей.
        </p>

        <form action={loginStaff} className="mt-8 space-y-4">
          <div>
            <label htmlFor="restaurantId" className="mb-2 block text-sm font-medium text-gray-700">
              Ресторан
            </label>
            <select
              id="restaurantId"
              name="restaurantId"
              required
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            >
              <option value="">Выберите ресторан</option>
              {restaurants?.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.restaurant_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pinCode" className="mb-2 block text-sm font-medium text-gray-700">
              PIN
            </label>
            <input
              id="pinCode"
              name="pinCode"
              type="password"
              required
              placeholder="Введите PIN"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
          >
            Войти
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
        ) : null}
      </div>
    </main>
  )
}