import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getCurrentUserSubscription,
  isSubscriptionCurrentlyActive,
} from '@/lib/subscription'
import { generateRedeemToken } from './actions'
import { RedeemTokenCard } from '@/components/redeem-token-card'

type PageProps = {
  params: Promise<{
    restaurantId: string
    offerId: string
  }>
  searchParams: Promise<{
    error?: string
    success?: string
  }>
}

type Restaurant = {
  id: string
  restaurant_name: string
  slug: string
}

type Offer = {
  id: string
  offer_title: string
  offer_terms_short: string
  offer_type: '2for1' | 'compliment'
}

type RedeemToken = {
  id: string
  token_code: string
  status: 'active' | 'redeemed' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
}

function getOfferBadgeLabel(type: Offer['offer_type']) {
  if (type === '2for1') return '1+1'
  return 'Комплимент'
}

function getRedeemErrorMessage(code?: string) {
  switch (code) {
    case 'active_token':
      return 'У вас уже есть активный код. Дождитесь его истечения или использования.'
    case 'cooldown':
      return 'Вы уже использовали оффер в этом ресторане в последние 7 дней.'
    case 'server_error':
      return 'Произошла ошибка. Попробуйте ещё раз.'
    default:
      return null
  }
}

export default async function RedeemPage({ params, searchParams }: PageProps) {
  const { restaurantId, offerId } = await params
  const { error, success } = await searchParams
  const errorMessage = getRedeemErrorMessage(error)

  const { user, subscription } = await getCurrentUserSubscription()

  if (!user) {
    redirect('/login')
  }

  if (!isSubscriptionCurrentlyActive(subscription)) {
    redirect('/pricing')
  }

  const supabase = await createSupabaseServerClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_name, slug')
    .eq('id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Restaurant>()

  const { data: offer } = await supabase
    .from('offers')
    .select('id, offer_title, offer_terms_short, offer_type')
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Offer>()

  if (!restaurant || !offer) {
    notFound()
  }

  const nowIso = new Date().toISOString()

  const { data: activeTokens, error: tokenError } = await supabase
    .from('redeem_tokens')
    .select('id, token_code, status, expires_at, created_at')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .eq('offer_id', offerId)
    .eq('status', 'active')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<RedeemToken[]>()

  if (tokenError) {
    throw new Error(tokenError.message)
  }

  const activeToken = activeTokens?.[0] ?? null

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
            {getOfferBadgeLabel(offer.offer_type)}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            Подписка активна
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-semibold">
          {restaurant.restaurant_name}
        </h1>

        <p className="mt-2 text-lg text-gray-900">{offer.offer_title}</p>
        <p className="mt-3 text-gray-600">{offer.offer_terms_short}</p>

        {success === 'code_generated' ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Код успешно создан. Покажите его сотруднику ресторана.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {activeToken ? (
          <RedeemTokenCard
            tokenCode={activeToken.token_code}
            expiresAt={activeToken.expires_at}
          />
        ) : (
          <div className="mt-8 rounded-2xl bg-gray-50 p-5">
            <p className="text-sm font-medium text-gray-900">Генерация кода</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Код будет действовать 10 минут. Одновременно можно иметь только 1 активный код.
              В одном ресторане оффер можно использовать 1 раз в 7 дней.
            </p>
           
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
              <li>Код действует 10 минут</li>
              <li>Одновременно можно иметь только 1 активный код</li>
              <li>В одном ресторане — не чаще 1 раза в 7 дней</li>
            </ul>

            <form action={generateRedeemToken} className="mt-5">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <input type="hidden" name="offerId" value={offer.id} />
              <button
                type="submit"
                className="inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
              >
                Сгенерировать код
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/r/${restaurant.slug}`}
            className="inline-flex rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black"
          >
            Назад к ресторану
          </Link>
        </div>
      </div>
    </main>
  )
}