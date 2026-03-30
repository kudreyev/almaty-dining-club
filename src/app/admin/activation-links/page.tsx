import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { buildActivationUrl } from '@/lib/activation-links'
import { createActivationLink } from './actions'
import { CopyLinkButton } from '@/components/copy-link-button'
import { PhoneInput } from '@/components/phone-input'
import { statusLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'

type ActivationLinkListRow = {
  id: string
  token: string
  phone_target: string
  amount: number
  currency: string
  status: string
  created_at: string
  expires_at: string
  activated_at: string | null
}

function waMeDigits(phoneE164: string) {
  return phoneE164.replace(/\D/g, '')
}

function buildManagerWhatsAppHref(phoneTarget: string, publicUrl: string) {
  const text = `Здравствуйте! Вот ссылка для активации подписки KudaPass на 1 месяц: ${publicUrl}\nВажно: войдите с номера ${phoneTarget}`
  const digits = waMeDigits(phoneTarget)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

function isValidFilter(value: string): value is 'active' | 'expired' | 'activated' | 'all' {
  return ['active', 'expired', 'activated', 'all'].includes(value)
}

async function countEvent(eventName: string, supabase: any, sinceIso: string) {
  const { count } = await supabase
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', eventName)
    .gte('created_at', sinceIso)
  return count ?? 0
}

function statusBadgeColor(status: string, isExpiredByTime: boolean): 'green' | 'yellow' | 'red' | 'blue' | 'default' {
  if (status === 'activated') return 'green'
  if (status === 'revoked') return 'red'
  if (isExpiredByTime || status === 'expired') return 'yellow'
  return 'blue'
}

export default async function AdminActivationLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; error?: string }>
}) {
  const { supabase } = await requireAdmin()

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [createdCount, openedCount, activatedCount, expiredCount] = await Promise.all([
    countEvent('activation_link_created', supabase, sinceIso),
    countEvent('activation_opened', supabase, sinceIso),
    countEvent('activation_activated', supabase, sinceIso),
    countEvent('activation_expired', supabase, sinceIso),
  ])
  const conversion = createdCount > 0 ? activatedCount / createdCount : 0
  const openedPerCreated = createdCount > 0 ? openedCount / createdCount : 0
  const activatedPerOpened = openedCount > 0 ? activatedCount / openedCount : 0

  const { filter: filterRaw, error: errorParam } = await searchParams
  const filter = filterRaw && isValidFilter(filterRaw) ? filterRaw : 'active'
  const nowIso = new Date().toISOString()

  let query = supabase
    .from('activation_links')
    .select('id, token, phone_target, amount, currency, status, created_at, expires_at, activated_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (filter === 'active') {
    query = query.eq('status', 'issued').gt('expires_at', nowIso)
  } else if (filter === 'expired') {
    query = query.or(`status.eq.expired,and(status.eq.issued,expires_at.lt.${nowIso})`)
  } else if (filter === 'activated') {
    query = query.eq('status', 'activated')
  }

  const { data: rows, error } = await query.returns<ActivationLinkListRow[]>()
  if (error) throw new Error(error.message)

  const metrics = [
    { label: 'Создано', value: createdCount },
    { label: 'Открыто', value: openedCount },
    { label: 'Активировано', value: activatedCount },
    { label: 'Истекло', value: expiredCount },
    { label: 'Конверсия', value: `${(conversion * 100).toFixed(1)}%` },
  ]

  const filterTabs = [
    { id: 'active', label: 'Активные', href: '/admin/activation-links?filter=active' },
    { id: 'expired', label: 'Истекшие', href: '/admin/activation-links?filter=expired' },
    { id: 'activated', label: 'Активированные', href: '/admin/activation-links?filter=activated' },
    { id: 'all', label: 'Все', href: '/admin/activation-links?filter=all' },
  ]

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Ссылки активации</h1>
        <p className="mt-1 text-sm text-gray-500">
          Создайте ссылку для клиента после оплаты. Срок — 24 часа.
        </p>
      </div>

      {/* METRICS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((m) => (
          <Card key={m.label} padding="sm">
            <p className="text-xs text-gray-400">{m.label} (7д)</p>
            <p className="mt-1 text-xl font-bold">{m.value}</p>
          </Card>
        ))}
      </div>

      <p className="mb-6 text-xs text-gray-400">
        открыто/создано: {(openedPerCreated * 100).toFixed(1)}% · активаций/открыто: {(activatedPerOpened * 100).toFixed(1)}%
      </p>

      {/* ERROR */}
      {errorParam === 'invalid_phone' ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Укажите корректный номер телефона.
        </div>
      ) : null}

      {/* CREATE FORM */}
      <Card className="mb-6">
        <form action={createActivationLink} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="phone_target" className="mb-1.5 block text-sm font-medium text-gray-700">
              Номер клиента
            </label>
            <PhoneInput id="phone_target" name="phone_target" required className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand" />
          </div>
          <div className="w-full sm:w-32">
            <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              Сумма (₸)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              defaultValue={4990}
              min={1}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand"
            />
          </div>
          <Button type="submit" size="lg">Создать</Button>
        </form>
      </Card>

      {/* FILTERS */}
      <div className="mb-6">
        <Tabs tabs={filterTabs} active={filter} />
      </div>

      {/* TABLE */}
      {!rows?.length ? (
        <EmptyState title="Пока нет ссылок" description="Создайте первую ссылку выше" />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Телефон</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Сумма</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Статус</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Создана</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const url = buildActivationUrl(row.token)
                  const waHref = buildManagerWhatsAppHref(row.phone_target, url)
                  const isExpiredByTime = new Date(row.expires_at).getTime() < Date.now()
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">{row.phone_target}</td>
                      <td className="px-4 py-3 text-gray-600">{row.amount} {row.currency}</td>
                      <td className="px-4 py-3">
                        <Badge color={statusBadgeColor(row.status, isExpiredByTime)}>
                          {statusLabel(row.status)}
                          {isExpiredByTime && row.status === 'issued' ? ' (истёк)' : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(row.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CopyLinkButton
                            textToCopy={url}
                            className="inline-flex rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          />
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
