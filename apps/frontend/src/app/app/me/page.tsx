import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { offerTypeLabel, subscriptionStatusLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

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

export default async function MePage({ searchParams }: PageProps) {
  const { payment } = await searchParams
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
      id, redeemed_at, restaurant_id, offer_id,
      restaurants ( restaurant_name, slug ),
      offers ( offer_title, offer_type )
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

  const subColor: 'green' | 'yellow' | 'default' =
    currentSubscription?.status === 'active' ? 'green' : currentSubscription ? 'yellow' : 'default'

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Личный кабинет</h1>
        <LogoutButton />
      </div>

      {payment === 'submitted' ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Заявка отправлена. После проверки подписка будет активирована.
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-gray-400">Телефон</p>
          <p className="mt-1 text-sm font-semibold">{displayedPhone}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400">Подписка</p>
              <Badge color={subColor} className="mt-1">
                {currentSubscription
                  ? subscriptionStatusLabel(currentSubscription.status)
                  : 'Не активна'}
              </Badge>
            </div>
            <Button href="/pricing" size="sm">
              Подписаться
            </Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-4 text-lg font-bold">История использований</h2>

      {!redemptions || redemptions.length === 0 ? (
        <EmptyState title="Пока нет использований" description="Активируйте оффер в ресторане" />
      ) : (
        <div className="space-y-3">
          {redemptions.map((item) => (
            <Card key={item.id} padding="sm" hover>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-sm">
                    {item.restaurants?.restaurant_name ?? '—'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {item.offers?.offer_title ?? '—'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge color={item.offers?.offer_type === '2for1' ? 'dark' : 'blue'}>
                    {item.offers?.offer_type ? offerTypeLabel(item.offers.offer_type) : '—'}
                  </Badge>
                  <p className="mt-1 text-xs text-gray-400">
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
