import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getCurrentUserSubscription,
  isSubscriptionCurrentlyActive,
} from '@/lib/subscription'
import { generateRedeemToken } from './actions'
import { RedeemTokenCard } from '@/components/redeem-token-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RESTAURANT_REDEEM_COOLDOWN_DAYS } from '@/lib/redeem-policy'

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

type Restaurant = { id: string; restaurant_name: string; slug: string }
type Offer = { id: string; offer_title: string; offer_terms_short: string; offer_type: '2for1' | 'compliment' }
type RedeemToken = { id: string; token_code: string; status: string; expires_at: string; created_at: string }

function getRedeemErrorMessage(code?: string) {
  switch (code) {
    case 'active_token': return 'У вас уже есть активный код.'
    case 'cooldown_restaurant':
      return `Этот оффер доступен не чаще 1 раза в ${RESTAURANT_REDEEM_COOLDOWN_DAYS} дней.`
    case 'server_error': return 'Ошибка. Попробуйте снова.'
    default: return null
  }
}

export default async function RedeemPage({ params, searchParams }: PageProps) {
  const { restaurantId, offerId } = await params
  const { error, success } = await searchParams
  const errorMessage = getRedeemErrorMessage(error)

  const { user, subscription } = await getCurrentUserSubscription()
  if (!user) redirect('/login')
  if (!isSubscriptionCurrentlyActive(subscription)) redirect('/pricing')

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

  if (!restaurant || !offer) notFound()

  const nowIso = new Date().toISOString()
  const { data: activeTokens } = await supabase
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

  const activeToken = activeTokens?.[0] ?? null

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <Card padding="lg">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="dark">
            {offer.offer_type === '2for1' ? '1+1' : 'Комплимент'}
          </Badge>
          <Badge color="green">Подписка активна</Badge>
        </div>

        <h1 className="mt-4 text-xl font-bold">{restaurant.restaurant_name}</h1>
        <p className="mt-1 text-sm font-medium">{offer.offer_title}</p>
        <p className="mt-2 text-sm text-gray-500">{offer.offer_terms_short}</p>

        {success === 'code_generated' ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Код создан. Покажите персоналу.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {activeToken ? (
          <RedeemTokenCard
            tokenCode={activeToken.token_code}
            expiresAt={activeToken.expires_at}
          />
        ) : (
          <div className="mt-6 rounded-xl bg-gray-50 p-4">
            <p className="text-sm font-medium">Генерация кода</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li>Код действует 10 минут</li>
              <li>Одновременно — 1 активный код</li>
              <li>{`Не чаще 1 раза в ${RESTAURANT_REDEEM_COOLDOWN_DAYS} дней на ресторан`}</li>
            </ul>

            <form action={generateRedeemToken} className="mt-4">
              <input type="hidden" name="restaurantId" value={restaurant.id} />
              <input type="hidden" name="offerId" value={offer.id} />
              <Button type="submit" className="w-full">
                Сгенерировать код
              </Button>
            </form>
          </div>
        )}

        <div className="mt-6">
          <Button href={`/r/${restaurant.slug}`} variant="secondary" size="sm">
            ← Назад к ресторану
          </Button>
        </div>
      </Card>
    </div>
  )
}
