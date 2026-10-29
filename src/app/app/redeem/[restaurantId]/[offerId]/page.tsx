import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getGuestAccess } from '@/lib/guest-access'
import { generateRedeemToken } from './actions'
import { RedeemTokenCard } from '@/components/redeem-token-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEFAULT_TZ } from '@/lib/opening-hours'
import {
  formatOfferHeadline,
  formatOfferUsableHoursStatus,
  getOfferUsableHours,
  type OfferType,
  type OfferUsableHour,
} from '@/lib/offers'

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
type OtherActiveToken = {
  restaurant_id: string
  offer_id: string
  restaurants: { restaurant_name: string } | null
}

function getRedeemErrorMessage(code: string | undefined, usableHoursLabel: string | null) {
  switch (code) {
    case undefined:
    case '':
      return null
    case 'active_token':
      return 'У вас уже есть активный код. Покажите его персоналу или дождитесь, пока он истечёт.'
    case 'usable_hours':
      return usableHoursLabel
        ? `Сейчас вне окна использования. ${usableHoursLabel}.`
        : 'Сейчас вне окна использования этого предложения.'
    case 'offer_unavailable':
      return 'Это предложение сейчас недоступно.'
    default:
      return 'Не удалось получить код. Попробуйте снова.'
  }
}

export default async function RedeemPage({ params, searchParams }: PageProps) {
  const { restaurantId, offerId } = await params
  const { error, success } = await searchParams

  const access = await getGuestAccess()
  if (access.kind !== 'member') {
    redirect(`/login?next=${encodeURIComponent(`/app/redeem/${restaurantId}/${offerId}`)}`)
  }
  const userId = access.user.id

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
      id, offer_title, offer_terms_short, offer_type, estimated_value, takeaway_only,
      offer_usable_hours ( day_of_week, is_unavailable, from_time, to_time, to_next_day )
    `)
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<Offer>()

  if (!restaurant || !offer) notFound()
  const now = new Date()
  const usableStatus = formatOfferUsableHoursStatus(
    getOfferUsableHours(offer),
    now,
    DEFAULT_TZ,
  )

  const { data: activeTokens } = await supabase
    .from('redeem_tokens')
    .select(
      'id, token_code, status, expires_at, created_at, extend_deadline_at, extended_once'
    )
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .eq('offer_id', offerId)
    .eq('status', 'active')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<RedeemToken[]>()

  const activeToken = activeTokens?.[0] ?? null

  let otherActiveToken: OtherActiveToken | null = null
  if (error === 'active_token' && !activeToken) {
    const { data } = await supabase
      .from('redeem_tokens')
      .select('restaurant_id, offer_id, restaurants ( restaurant_name )')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('used_at', null)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<OtherActiveToken>()
    otherActiveToken = data ?? null
  }

  const errorMessage = getRedeemErrorMessage(error, usableStatus.label)

  const blockedLabel = usableStatus.isUsable ? null : (usableStatus.label ?? 'Сейчас недоступно')

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
          {access.isFounder ? <Badge color="green">Основатель клуба</Badge> : null}
        </div>

        <h1 className="mt-4 text-xl font-bold">{restaurant.restaurant_name}</h1>
        <p className="mt-1 text-sm font-medium">{formatOfferHeadline(offer.offer_type, offer.offer_title)}</p>
        <p className="mt-2 whitespace-pre-line text-sm text-gray-500">{offer.offer_terms_short}</p>

        {success === 'code_generated' ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Код готов. Покажите его официанту.
          </div>
        ) : null}

        {errorMessage && !activeToken ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
            {otherActiveToken ? (
              <>
                {' '}
                <Link
                  href={`/app/redeem/${otherActiveToken.restaurant_id}/${otherActiveToken.offer_id}`}
                  className="font-medium underline underline-offset-2"
                >
                  Открыть код
                  {otherActiveToken.restaurants?.restaurant_name
                    ? ` (${otherActiveToken.restaurants.restaurant_name})`
                    : ''}
                </Link>
              </>
            ) : null}
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
            <p className="text-sm font-medium">Как это работает</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li>Код действует 10 минут</li>
              <li>Одновременно — 1 активный код</li>
              {offer.takeaway_only ? <li>Действует только на вынос</li> : null}
              {usableStatus.label ? <li>{usableStatus.label}</li> : null}
            </ul>

            {blockedLabel ? (
              <Button type="button" className="mt-4 w-full" disabled>
                {blockedLabel}
              </Button>
            ) : (
              <form action={generateRedeemToken} className="mt-4">
                <input type="hidden" name="restaurantId" value={restaurant.id} />
                <input type="hidden" name="offerId" value={offer.id} />
                <Button type="submit" className="w-full">
                  Получить код
                </Button>
              </form>
            )}
          </div>
        )}

        <div className="mt-6">
          <Button href={`/r/${restaurant.slug}`} variant="secondary" size="sm">
            ← Назад к заведению
          </Button>
        </div>
      </Card>
    </div>
  )
}
