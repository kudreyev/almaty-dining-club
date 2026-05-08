import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getStaffSessionRestaurantId } from '@/lib/staff-session'
import { logoutStaff } from '../login/actions'
import { redeemTokenByCode, verifyStaffPinForRedeem } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Restaurant = {
  id: string
  restaurant_name: string
}

type PageProps = {
  searchParams: Promise<{
    token?: string
    error?: string
    success?: string
  }>
}

async function loadRestaurantForPin(restaurantId: string) {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Restaurant>()
  return data
}

async function loadGateByGuestToken(tokenCode: string) {
  const admin = createSupabaseAdminClient()
  const { data: token } = await admin
    .from('redeem_tokens')
    .select('restaurant_id')
    .eq('token_code', tokenCode)
    .maybeSingle<{ restaurant_id: string }>()
  if (!token) return null
  const restaurant = await loadRestaurantForPin(token.restaurant_id)
  if (!restaurant) return null
  return { restaurant, tokenCode }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case 'missing_code':
      return 'Введите код.'
    case 'missing_pin':
      return 'Введите PIN.'
    case 'invalid_pin':
      return 'Неверный PIN.'
    case 'invalid_token':
      return 'Код не найден или не совпадает с рестораном.'
    case 'pin_verify_failed':
      return 'Не удалось проверить PIN. Попробуйте снова.'
    case 'session_error':
      return 'Не удалось создать сессию. Попробуйте снова.'
    case 'not_found':
      return 'Код не найден.'
    case 'already_used':
      return 'Этот код уже использован.'
    case 'expired':
      return 'Срок действия кода истёк.'
    case 'update_failed':
      return 'Не удалось обновить токен.'
    case 'redemption_failed':
      return 'Не удалось записать подтверждение.'
    case 'wrong_restaurant':
      return 'Этот код выдан для другого ресторана.'
    case 'token_not_found':
      return 'Код не найден.'
    case 'rate_limited':
      return 'Слишком много неверных попыток. Подождите и попробуйте позже или обратитесь в поддержку.'
    default:
      return null
  }
}

export default async function StaffRedeemPage({ searchParams }: PageProps) {
  const { token: tokenParam, error, success } = await searchParams
  const tokenFromUrl = tokenParam?.trim() ?? ''
  const sessionRestaurantId = await getStaffSessionRestaurantId()

  if (!sessionRestaurantId && !tokenFromUrl) {
    redirect('/staff/login')
  }

  const errorMessage = getErrorMessage(error)

  // Нет сессии — только вход по PIN с ссылкой из QR
  if (!sessionRestaurantId) {
    const gate = await loadGateByGuestToken(tokenFromUrl)
    if (!gate) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
          <Card className="w-full max-w-sm" padding="lg">
            <h1 className="text-xl font-bold">Недействительная ссылка</h1>
            <p className="mt-2 text-sm text-gray-600">
              Код в ссылке не найден. Попросите гостя обновить QR или откройте вход
              для персонала.
            </p>
            <Button href="/staff/login" className="mt-6 w-full">
              Вход для персонала
            </Button>
          </Card>
        </div>
      )
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
        <Card className="w-full max-w-sm" padding="lg">
          <h1 className="text-xl font-bold">Вход персонала</h1>
          <p className="mt-1 text-sm text-gray-500">{gate.restaurant.restaurant_name}</p>
          <p className="mt-2 text-xs text-gray-500">
            Введите PIN один раз — дальше на этом устройстве вход сохранится на 7 дней.
          </p>

          {errorMessage ? (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <form action={verifyStaffPinForRedeem} className="mt-6 space-y-4">
            <input type="hidden" name="restaurantId" value={gate.restaurant.id} />
            <input type="hidden" name="tokenCode" value={gate.tokenCode} />
            <Input
              id="pinCode"
              name="pinCode"
              type="password"
              label="PIN ресторана"
              required
              autoComplete="one-time-code"
              placeholder="PIN"
              data-ym-disable-keys
            />
            <Button type="submit" className="w-full">
              Продолжить
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name')
    .eq('id', sessionRestaurantId)
    .eq('is_active', true)
    .maybeSingle<Restaurant>()

  if (!restaurant) {
    redirect('/staff/login')
  }

  let tokenUrlIssue: 'none' | 'not_found' | 'wrong_restaurant' = 'none'
  if (tokenFromUrl) {
    const admin = createSupabaseAdminClient()
    const { data: tokenRow } = await admin
      .from('redeem_tokens')
      .select('restaurant_id')
      .eq('token_code', tokenFromUrl)
      .maybeSingle<{ restaurant_id: string }>()
    if (!tokenRow) {
      tokenUrlIssue = 'not_found'
    } else if (tokenRow.restaurant_id !== sessionRestaurantId) {
      tokenUrlIssue = 'wrong_restaurant'
    }
  }

  const tokenMismatchError =
    tokenUrlIssue === 'not_found'
      ? getErrorMessage('token_not_found')
      : tokenUrlIssue === 'wrong_restaurant'
        ? getErrorMessage('wrong_restaurant')
        : null

  const displayError = errorMessage ?? tokenMismatchError

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-sm" padding="lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Подтверждение кода</h1>
            <p className="mt-1 text-sm text-gray-500">{restaurant.restaurant_name}</p>
          </div>
          <div className="flex gap-1">
            <Button href="/staff/history" variant="ghost" size="sm">
              История
            </Button>
            <form action={logoutStaff}>
              <Button type="submit" variant="ghost" size="sm">
                Выйти
              </Button>
            </form>
          </div>
        </div>

        {success === 'confirmed' ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Подтверждено ✅
          </div>
        ) : null}

        {displayError ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {displayError}
          </div>
        ) : null}

        {tokenFromUrl && tokenUrlIssue === 'none' ? (
          <form action={redeemTokenByCode} className="mt-6 space-y-4">
            <input type="hidden" name="tokenCode" value={tokenFromUrl} />
            <p className="text-center text-2xl font-semibold tracking-[0.15em]">
              {tokenFromUrl}
            </p>
            <p className="text-center text-xs text-gray-500">
              Нажмите, когда гость предъявил этот код.
            </p>
            <Button type="submit" className="w-full">
              Подтвердить
            </Button>
          </form>
        ) : (
          <form action={redeemTokenByCode} className="mt-6 space-y-4">
            <Input
              id="tokenCode"
              name="tokenCode"
              type="text"
              label="Код гостя"
              required
              defaultValue={tokenUrlIssue !== 'none' ? '' : tokenFromUrl}
              placeholder="Например: 482193"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm tracking-[0.2em] outline-none transition-colors focus:border-accent"
              data-ym-disable-keys
            />
            <Button type="submit" className="w-full">
              Подтвердить код
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
