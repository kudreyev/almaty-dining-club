import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { offerTypeLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PwaProfileSection } from '@/components/pwa/pwa-profile-section'
import { DiscountCodeCard } from '@/components/me/discount-code-card'
import { FounderBadge } from '@/components/me/founder-badge'
import { LifetimeSavings } from '@/components/me/lifetime-savings'
import { NewVenuesBlock } from '@/components/me/new-venues-block'
import { loadNewestRestaurants } from '@/lib/home/load-newest-restaurants'
import { getGuestAccess, getUserSavings } from '@/lib/guest-access'
import { getCurrentCity } from '@/lib/current-city'

type Redemption = {
  id: string
  redeemed_at: string
  restaurant_id: string
  offer_id: string
  restaurants: {
    restaurant_name: string
    slug: string
  } | null
  offers: {
    offer_title: string
    offer_type: '2for1' | 'compliment'
  } | null
}

type LastRedeemToken = {
  token_code: string
  status: string
  expires_at: string
  restaurants: { restaurant_name: string } | null
  offers: { offer_title: string } | null
}

export default async function MePage() {
  const access = await getGuestAccess()
  if (access.kind === 'guest') redirect('/login?next=/app/me')

  const user = access.user
  const supabase = await createSupabaseServerClient()

  const city = await getCurrentCity()

  const [{ data: profile }, { data: redemptions }, { data: lastTokens }, newestVenues, savings] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<{ role: 'user' | 'admin' }>(),
      supabase
        .from('redemptions')
        .select(`
          id, redeemed_at, restaurant_id, offer_id,
          restaurants ( restaurant_name, slug ),
          offers ( offer_title, offer_type )
        `)
        .eq('user_id', user.id)
        .order('redeemed_at', { ascending: false })
        .limit(10)
        .returns<Redemption[]>(),
      supabase
        .from('redeem_tokens')
        .select(`
          token_code, status, expires_at,
          restaurants ( restaurant_name ),
          offers ( offer_title )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<LastRedeemToken[]>(),
      loadNewestRestaurants(3, city),
      getUserSavings(user.id),
    ])

  const lastToken = lastTokens?.[0] ?? null

  const whatsappPhoneFromMetadata =
    typeof user.user_metadata?.phone_e164 === 'string'
      ? user.user_metadata.phone_e164
      : null
  const displayedPhone = access.phone || whatsappPhoneFromMetadata || 'Не указан'

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Личный кабинет</h1>
        <LogoutButton />
      </div>

      <DiscountCodeCard
        tokenCode={lastToken?.token_code ?? null}
        status={lastToken?.status ?? null}
        expiresAt={lastToken?.expires_at ?? null}
        restaurantName={lastToken?.restaurants?.restaurant_name ?? null}
        offerTitle={lastToken?.offers?.offer_title ?? null}
      />

      <LifetimeSavings
        amountKzt={savings.amountKzt}
        redemptionsCount={savings.redemptionsCount}
      />

      <PwaProfileSection />

      <NewVenuesBlock venues={newestVenues} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gray-400">Телефон</p>
          <p className="mt-1 text-base font-semibold">{displayedPhone}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-400">Доступ</p>
          <p className="mt-1 text-base font-semibold">Ваш доступ: бесплатно, навсегда</p>
          {access.isFounder ? (
            <div className="mt-2">
              <FounderBadge />
            </div>
          ) : null}
          {access.kind === 'unverified' ? (
            <p className="mt-2 text-sm text-gray-600">
              Подтвердите номер, чтобы получать коды.{' '}
              <Link
                href="/login?next=/app/me"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Подтвердить
              </Link>
            </p>
          ) : null}
        </Card>
      </div>

      {access.isFounder ? (
        <p className="-mt-2 mb-6 text-sm leading-relaxed text-gray-500">
          Вы были с нами на подписке. Списания отключены, все предложения доступны
          бесплатно, а новые заведения вы увидите первыми.
        </p>
      ) : null}

      <h2 className="mb-4 text-lg font-semibold">История использований</h2>

      {!redemptions || redemptions.length === 0 ? (
        <EmptyState
          title="Пока нет использований"
          description="Выберите заведение и нажмите «Получить код»"
        />
      ) : (
        <div className="space-y-3">
          {redemptions.map((item) => (
            <Card key={item.id} padding="sm" hover>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {item.restaurants?.restaurant_name ?? '—'}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {item.offers?.offer_title ?? '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge color={item.offers?.offer_type === '2for1' ? 'dark' : 'blue'}>
                    {item.offers?.offer_type ? offerTypeLabel(item.offers.offer_type) : '—'}
                  </Badge>
                  <p className="mt-1 text-sm text-gray-400">
                    {new Date(item.redeemed_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button href={`/${city}`} variant="secondary" size="sm">
          Все заведения
        </Button>
        {profile?.role === 'admin' ? (
          <Button href="/admin/dashboard" variant="secondary" size="sm">
            Админка
          </Button>
        ) : null}
      </div>
    </div>
  )
}
