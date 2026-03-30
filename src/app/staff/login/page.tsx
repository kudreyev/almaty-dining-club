import { createSupabaseServerClient } from '@/lib/supabase/server'
import { loginStaff } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, Input } from '@/components/ui/input'

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
  if (error === 'invalid_pin') return 'Неверный PIN для выбранного ресторана.'
  if (error === 'missing_fields') return 'Заполните все поля.'
  if (error === 'no_staff_for_restaurant') return 'Для этого ресторана не найдена учётная запись персонала.'
  if (error === 'db_error') return `Ошибка базы данных: ${message || 'неизвестно'}`
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
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-sm" padding="lg">
        <h1 className="text-xl font-bold">Вход для персонала</h1>
        <p className="mt-2 text-sm text-gray-500">
          Войдите по PIN для проверки кодов гостей.
        </p>

        <form action={loginStaff} className="mt-6 space-y-4">
          <Select id="restaurantId" name="restaurantId" label="Ресторан" required>
            <option value="">Выберите ресторан</option>
            {restaurants?.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.restaurant_name}
              </option>
            ))}
          </Select>

          <Input
            id="pinCode"
            name="pinCode"
            type="password"
            label="PIN"
            required
            placeholder="Введите PIN"
          />

          <Button type="submit" className="w-full">
            Войти
          </Button>
        </form>

        {errorMessage ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
