import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { paymentStatusLabel, subscriptionStatusLabel } from '@/lib/labels'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  role: 'user' | 'admin'
}

type PaymentRequest = {
  id: string
  payment_code: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  comment_from_user: string | null
  submitted_at: string
}

type Subscription = {
  id: string
  status: 'inactive' | 'pending_payment' | 'active' | 'expired'
  plan_name: string
  start_date: string | null
  end_date: string | null
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
    .select('id, full_name, phone, email, role')
    .eq('id', user.id)
    .single<Profile>()

  const { data: paymentRequests } = await supabase
    .from('payment_requests')
    .select('id, payment_code, amount, status, comment_from_user, submitted_at')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .returns<PaymentRequest[]>()

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, plan_name, start_date, end_date')
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Личный кабинет</h1>
            <p className="mt-3 text-gray-600">
              Ваш аккаунт, подписка и заявки на оплату.
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
            <p className="text-sm text-gray-500">Email</p>
            <p className="mt-1 font-medium">{user.email}</p>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Роль</p>
            <p className="mt-1 font-medium">{profile?.role ?? '—'}</p>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Имя</p>
            <p className="mt-1 font-medium">{profile?.full_name || 'Не указано'}</p>
          </div>

          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Телефон</p>
            <p className="mt-1 font-medium">{profile?.phone || 'Не указан'}</p>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Подписка</h2>
              <p className="mt-2 text-sm text-gray-600">
                Текущий статус доступа к офферам.
              </p>
            </div>

            <Link
              href="/pricing"
              className="inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Перейти к pricing
            </Link>
          </div>

          {!currentSubscription ? (
            <div className="mt-6 rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Подписка пока не активирована.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">Статус</p>
                <p className="mt-1 font-medium">
                  {subscriptionStatusLabel(currentSubscription.status)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">План</p>
                <p className="mt-1 font-medium">{currentSubscription.plan_name}</p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-5">
                <p className="text-sm text-gray-500">Срок действия</p>
                <p className="mt-1 font-medium">
                  {currentSubscription.start_date && currentSubscription.end_date
                    ? `${currentSubscription.start_date} → ${currentSubscription.end_date}`
                    : '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Мои заявки на оплату</h2>
            <Link
              href="/payment/submit"
              className="inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Новая заявка
            </Link>
          </div>

          {!paymentRequests || paymentRequests.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              У вас пока нет заявок на оплату.
            </div>
          ) : (
            <div className="space-y-4">
              {paymentRequests.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Payment code</p>
                      <p className="font-medium">{item.payment_code}</p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {paymentStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-500">Сумма</p>
                      <p className="font-medium">{item.amount} ₸</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Дата</p>
                      <p className="font-medium">
                        {new Date(item.submitted_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>

                  {item.comment_from_user ? (
                    <div className="mt-4 rounded-xl bg-gray-50 p-3">
                      <p className="text-sm text-gray-500">Комментарий</p>
                      <p className="mt-1 text-sm text-gray-700">{item.comment_from_user}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
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
              Перейти в admin payments
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}