import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { offerTypeLabel, subscriptionStatusLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MeMetrica } from './me-metrica'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { VenuesSection } from '@/components/home/venues-section'
import { HomeMobileControls } from '@/components/home/home-mobile-controls'
import SubscribeCTA from '@/components/checkout/subscribe-cta'
import { PwaCabinetInstallBanner } from '@/components/pwa/pwa-cabinet-install-banner'
import { PwaInstallMenuItem } from '@/components/pwa/pwa-install-menu-item'
import { PwaPushOptIn } from '@/components/pwa/pwa-push-opt-in'
import { DiscountCodeCard } from '@/components/me/discount-code-card'
import { LifetimeSavings } from '@/components/me/lifetime-savings'
import { NewVenuesBlock } from '@/components/me/new-venues-block'
import { loadHomeRestaurants } from '@/lib/home/load-home-restaurants'
import { loadNewestRestaurants } from '@/lib/home/load-newest-restaurants'
import {
  getUserSavings,
  isSubscriptionCurrentlyActive,
} from '@/lib/subscription'
import { pluralizeRu } from '@/lib/ru-plural'
import { CITY_COOKIE, CITY_LABELS_GENITIVE, DEFAULT_CITY, isCity } from '@/lib/cities'
import { formatPriceKzt } from '@/lib/pricing'

type Profile = {
  id: string
  phone: string | null
  role: 'user' | 'admin'
}

type Subscription = {
  id: string
  status: 'inactive' | 'pending_payment' | 'active' | 'cancelled' | 'expired'
  start_date: string | null
  end_date: string | null
  tiptop_subscription_id: string | null
}

type PageProps = {
  searchParams: Promise<{
    payment?: string
  }>
}

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

export default async function MePage({ searchParams }: PageProps) {
  const { payment } = await searchParams
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const cityCookie = (await cookies()).get(CITY_COOKIE)?.value
  const city = isCity(cityCookie) ? cityCookie : DEFAULT_CITY

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, phone, role')
    .eq('id', user.id)
    .single<Profile>()

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, start_date, end_date, tiptop_subscription_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<Subscription[]>()

  const latestSubscription = subscriptions?.[0] ?? null
  const hasAnySubscription = (subscriptions?.length ?? 0) > 0
  const isActive = isSubscriptionCurrentlyActive(latestSubscription)

  const whatsappPhoneFromMetadata =
    typeof user.user_metadata?.phone_e164 === 'string'
      ? user.user_metadata.phone_e164
      : null
  const displayedPhone = profile?.phone || whatsappPhoneFromMetadata || 'Не указан'

  // Ветка для бывших / неактивных подписчиков: вместо пустого кабинета
  // показываем экран реактивации + каталог. Историю redemptions скрываем —
  // фокус на возврате к подписке. completeActivation/activate RPC не трогаем.
  if (!isActive) {
    const { restaurantsWithStatus, cuisineOptions } = await loadHomeRestaurants(city)
    const totalVenues = restaurantsWithStatus.length
    const venuesWord = pluralizeRu(totalVenues, [
      'заведение',
      'заведения',
      'заведений',
    ])
    const cityName = CITY_LABELS_GENITIVE[city]
    const venuesSectionTitle =
      totalVenues > 0 ? `${totalVenues} ${venuesWord} ${cityName}` : `Заведения ${cityName}`

    const title = hasAnySubscription ? 'Подписка закончилась' : 'Подписка неактивна'
    const description = hasAnySubscription
      ? 'Продли подписку, чтобы снова пользоваться 1+1 и подарками к заказу. Оплата картой онлайн — доступ откроется сразу.'
      : 'Оформи подписку, чтобы пользоваться 1+1 и подарками к заказу. Оплата картой онлайн — доступ откроется сразу.'

    return (
      <>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <Suspense fallback={null}>
            <MeMetrica />
          </Suspense>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Личный кабинет</h1>
            <LogoutButton />
          </div>

          <Card className="mb-6">
            <p className="text-sm text-gray-400">Телефон</p>
            <p className="mt-1 text-base font-semibold">{displayedPhone}</p>
          </Card>

          <div className="rounded-xl border border-primary-light/60 bg-primary-light/30 p-6">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-[1.55] text-gray-700">{description}</p>

            <SubscribeCTA
              source={hasAnySubscription ? 'me-expired' : 'me-no-sub'}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#D85A30] px-5 py-[11px] text-[14px] font-medium text-white transition-opacity hover:opacity-95"
            >
              {hasAnySubscription ? `Продлить за ${formatPriceKzt()}` : `Оформить за ${formatPriceKzt()}`}
            </SubscribeCTA>
          </div>

          {profile?.role === 'admin' ? (
            <div className="mt-8">
              <Button href="/admin/payments" variant="secondary" size="sm">
                Заявки на оплату (админ)
              </Button>
            </div>
          ) : null}
        </div>

        <div id="venues" className="mx-auto max-w-6xl px-5 pb-12 pt-2 md:pb-16">
          <VenuesSection
            restaurants={restaurantsWithStatus}
            cuisineOptions={cuisineOptions}
            city={city}
            title={venuesSectionTitle}
          />
          <HomeMobileControls
            cuisineOptions={cuisineOptions}
            applyCount={restaurantsWithStatus.length}
            city={city}
          />
        </div>
      </>
    )
  }

  // Активная подписка — PWA home: код, экономия, новинки, история.
  const [{ data: redemptions }, { data: lastTokens }, newestVenues, savings] =
    await Promise.all([
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

  const subColor: 'green' | 'yellow' | 'default' =
    latestSubscription?.status === 'active'
      ? 'green'
      : latestSubscription
        ? 'yellow'
        : 'default'

  const paidUntilLabel = latestSubscription?.end_date
    ? new Date(latestSubscription.end_date).toLocaleDateString('ru-RU')
    : null

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Suspense fallback={null}>
        <MeMetrica />
      </Suspense>
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

      <div className="mb-6">
        <PwaInstallMenuItem />
      </div>

      <PwaCabinetInstallBanner />
      <PwaPushOptIn />

      {payment === 'submitted' ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">
          Заявка отправлена. После проверки подписка будет активирована.
        </div>
      ) : null}

      <NewVenuesBlock venues={newestVenues} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gray-400">Телефон</p>
          <p className="mt-1 text-base font-semibold">{displayedPhone}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-400">Подписка</p>
              <Badge color={subColor} className="mt-1">
                {latestSubscription
                  ? subscriptionStatusLabel(latestSubscription.status)
                  : 'Не активна'}
              </Badge>
            </div>
          </div>
          {latestSubscription?.status === 'active' &&
          latestSubscription.tiptop_subscription_id ? (
            <CancelSubscriptionButton paidUntil={latestSubscription.end_date} />
          ) : latestSubscription?.status === 'cancelled' ? (
            <p className="mt-3 text-sm text-gray-600">
              Автосписаний больше не будет.
              {paidUntilLabel ? ` Доступ сохранится до ${paidUntilLabel}.` : ''}
            </p>
          ) : null}
        </Card>
      </div>

      <h2 className="mb-4 text-lg font-semibold">История использований</h2>

      {!redemptions || redemptions.length === 0 ? (
        <EmptyState title="Пока нет использований" description="Активируйте оффер в ресторане" />
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

      {profile?.role === 'admin' ? (
        <div className="mt-8">
          <Button href="/admin/payments" variant="secondary" size="sm">
            Заявки на оплату (админ)
          </Button>
        </div>
      ) : null}
    </div>
  )
}
