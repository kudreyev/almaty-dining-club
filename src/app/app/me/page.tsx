import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { subscriptionStatusLabel } from '@/lib/labels'

type Profile = {
  id: string
  phone: string | null
  role: 'user' | 'admin'
}

type Subscription = {
  id: string
  status: 'inactive' | 'pending_payment' | 'active' | 'expired'
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

function getOfferTypeLabel(type: '2for1' | 'compliment') {
  if (type === '2for1') return '1+1'
  return 'Комплимент'
}

export default async function MePage({ searchParams }: PageProps) {
  const { payment } = await searchParams
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, phone, role')
    .eq('id', user.id)
    .single<Profile>()

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<Subscription[]>()

  const { data: redemptions } = await supabase
    .from('redemptions')
    .select(`
      id,
      redeemed_at,
      restaurant_id,
      offer_id,
      restaurants (
        restaurant_name,
        slug
      ),
      offers (
        offer_title,
        offer_type
      )
    `)
    .eq('user_id', user.id)
    .order('redeemed_at', { ascending: false })
    .limit(10)
    .returns<Redemption[]>()

  const currentSubscription = subscriptions?.[0] ?? null
  const whatsappPhoneFromMetadata =
    typeof user.user_metadata?.phone_e164 === 'string'
      ? user.user_metadata.phone_e164
      : null
  const displayedPhone = profile?.phone || whatsappPhoneFromMetadata || 'Не указан'

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Личный кабинет</h1>
            <p className="mt-3 text-gray-600">
              Ваш аккаунт и статус подписки.
            </p>
          </div>

          <LogoutButton />
        </div>

        {payment === 'submitted' ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Заявка на оплату отправлена. После проверки мы активируем подписку.
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Номер телефона</p>
            <p className="mt-1 font-medium">{displayedPhone}</p>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Подписка</p>
                <p className="mt-1 font-medium">
                  {currentSubscription
                    ? subscriptionStatusLabel(currentSubscription.status)
                    : 'Не активна'}
                </p>
              </div>

              <Link
                href="/pricing"
                className="inline-flex shrink-0 rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Подписаться
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">История использований</h2>
          </div>

          {!redemptions || redemptions.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Вы ещё не использовали ни одного оффера.
            </div>
          ) : (
            <div className="space-y-4">
              {redemptions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Ресторан</p>
                      <p className="font-medium">
                        {item.restaurants?.restaurant_name ?? '—'}
                      </p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {item.offers?.offer_type
                        ? getOfferTypeLabel(item.offers.offer_type)
                        : 'Оффер'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-500">Оффер</p>
                      <p className="font-medium">
                        {item.offers?.offer_title ?? '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Дата использования</p>
                      <p className="font-medium">
                        {new Date(item.redeemed_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {item.restaurants?.slug ? (
                    <div className="mt-4">
                      <Link
                        href={`/r/${item.restaurants.slug}`}
                        className="inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
                      >
                        Открыть ресторан
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {profile?.role === 'admin' ? (
          <div className="mt-10">
            <Link
              href="/admin/payments"
              className="inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Заявки на оплату (админка)
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}