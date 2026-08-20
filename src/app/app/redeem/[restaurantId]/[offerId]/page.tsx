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
import { DEFAULT_TZ } from '@/lib/opening-hours'
import {
  formatOfferCooldownText,
  formatOfferHeadline,
  formatOfferUsableHoursStatus,
  getOfferUsableHours,
  resolveOfferCooldownDays,
  type OfferType,
  type OfferUsableHour,
} from '@/lib/offers'
import { ruDayWordAfterNumber } from '@/lib/ru-plural'

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
type Offer = {
  id: string
  offer_title: string
  offer_terms_short: string
  offer_type: OfferType
  estimated_value: number | null
  cooldown_days?: number | null
  takeaway_only?: boolean
  offer_usable_hours?: OfferUsableHour[]
}
type RedeemToken = {
  id: string
  token_code: string
  status: string
  expires_at: string
  created_at: string
  extend_deadline_at: string
  extended_once: boolean
}

function getRedeemErrorMessage(
  code: string | undefined,
  cooldownDays: number,
  usableHoursLabel: string | null,
) {
  switch (code) {
    case 'active_token': return 'У вас уже есть активный код.'
    case 'cooldown_offer':
      return cooldownDays === 1
        ? 'Этот оффер доступен не чаще одного раза в день.'
        : `Этот оффер доступен не чаще одного раза в ${cooldownDays} ${ruDayWordAfterNumber(cooldownDays)}.`
    case 'usable_hours':
      return usableHoursLabel
        ? `Сейчас вне окна использования. ${usableHoursLabel}.`
        : 'Сейчас вне окна использования этого оффера.'
    case 'server_error': return 'Ошибка. Попробуйте снова.'
    default: return null
  }
}

export default async function RedeemPage({ params, searchParams }: PageProps) {
  const { restaurantId, offerId } = await params
  const { error, success } = await searchParams

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
    .select(`
      id, offer_title, offer_terms_short, offer_type, estimated_value, cooldown_days, takeaway_only,
      offer_usable_hours ( day_of_week, is_unavailable, from_time, to_time, to_next_day )
    `)
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Offer>()

  if (!restaurant || !offer) notFound()
  const now = new Date()
  const offerCooldownDays = resolveOfferCooldownDays(offer.cooldown_days)
  const usableStatus = formatOfferUsableHoursStatus(
    getOfferUsableHours(offer),
    now,
    DEFAULT_TZ,
  )
  const errorMessage = getRedeemErrorMessage(error, offerCooldownDays, usableStatus.label)
  const canGenerateCode = usableStatus.isUsable

  const { data: activeTokens } = await supabase
    .from('redeem_tokens')
    .select(
      'id, token_code, status, expires_at, created_at, extend_deadline_at, extended_once'
    )
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .eq('offer_id', offerId)
    .eq('status', 'active')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<RedeemToken[]>()

  const activeToken = activeTokens?.[0] ?? null

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <Card padding="lg">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="dark">
            {offer.offer_type === '2for1'
              ? '1+1'
              : offer.offer_type === 'kudafest_set'
                ? 'Kudafest'
                : 'в подарок'}
          </Badge>
          {offer.takeaway_only ? <Badge color="accent">Только на вынос</Badge> : null}
          <Badge color="green">Подписка активна</Badge>
        </div>

        <h1 className="mt-4 text-xl font-bold">{restaurant.restaurant_name}</h1>
        <p className="mt-1 text-sm font-medium">{formatOfferHeadline(offer.offer_type, offer.offer_title)}</p>
        <p className="mt-2 whitespace-pre-line text-sm text-gray-500">{offer.offer_terms_short}</p>

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
            tokenId={activeToken.id}
            tokenCode={activeToken.token_code}
            expiresAt={activeToken.expires_at}
            extendDeadlineAt={activeToken.extend_deadline_at}
            extendedOnce={activeToken.extended_once}
            restaurantId={restaurant.id}
            offerId={offer.id}
            metricaOffer={{
              restaurantSlug: restaurant.slug,
              offerType: offer.offer_type,
              estimatedSavingsTenge:
                typeof offer.estimated_value === 'number' &&
                Number.isFinite(offer.estimated_value)
                  ? Math.round(offer.estimated_value)
                  : null,
            }}
          />
        ) : (
          <div className="mt-6 rounded-xl bg-gray-50 p-4">
            <p className="text-sm font-medium">Генерация кода</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li>Код действует 10 минут</li>
              <li>Одновременно — 1 активный код</li>
              <li>{formatOfferCooldownText(offerCooldownDays)}</li>
              {offer.takeaway_only ? <li>Действует только на вынос</li> : null}
              {usableStatus.label ? <li>{usableStatus.label}</li> : null}
            </ul>

            {canGenerateCode ? (
              <form action={generateRedeemToken} className="mt-4">
                <input type="hidden" name="restaurantId" value={restaurant.id} />
                <input type="hidden" name="offerId" value={offer.id} />
                <Button type="submit" className="w-full">
                  Сгенерировать код
                </Button>
              </form>
            ) : (
              <Button type="button" className="mt-4 w-full" disabled>
                {usableStatus.label ?? 'Сейчас недоступно'}
              </Button>
            )}
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
