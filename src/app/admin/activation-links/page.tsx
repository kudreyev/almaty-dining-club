import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { buildActivationUrl } from '@/lib/activation-links'
import {
  activationLinkUserKindBadgeColor,
  activationLinkUserKindBadgeLabel,
  buildInternalUsersIndex,
  enrichInternalIndexWithPhones,
  resolveActivationLinkDisplayKind,
  shouldShowActivationLinkInList,
} from '@/lib/activation-links-list'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
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
  kind: 'paid' | 'trial'
  trial_days: number | null
  created_at: string
  expires_at: string
  activated_at: string | null
  activated_user_id: string | null
}

function waMeDigits(phoneE164: string) {
  return phoneE164.replace(/\D/g, '')
}

function buildManagerWhatsAppHref(
  phoneTarget: string,
  publicUrl: string,
  kind: 'paid' | 'trial',
  trialDays: number | null,
) {
  const text =
    kind === 'trial'
      ? `Здравствуйте! Вот ссылка для активации пробного доступа Kudaclub на ${trialDays ?? 14} дней: ${publicUrl}\nВажно: войдите с номера ${phoneTarget}`
      : `Здравствуйте! Вот ссылка для активации подписки Kudaclub на 1 месяц: ${publicUrl}\nВажно: войдите с номера ${phoneTarget}`
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

const ERROR_MESSAGES: Record<string, string> = {
  invalid_phone: 'Укажите корректный номер телефона.',
  trial_already_used:
    'Пробный доступ уже выдавался этому номеру (активация подтверждена).',
  trial_link_pending:
    'Для этого номера уже создана активная trial-ссылка. Сначала дождитесь её активации или истечения.',
}

const SUCCESS_MESSAGES: Record<string, string> = {
  paid: 'Платная ссылка создана.',
  trial: 'Trial-ссылка на 14 дней создана.',
}

function buildListHref(filter: string, showInternal: boolean): string {
  const params = new URLSearchParams({ filter })
  if (showInternal) params.set('showInternal', '1')
  return `/admin/activation-links?${params.toString()}`
}

export default async function AdminActivationLinksPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string
    error?: string
    created?: string
    showInternal?: string
  }>
}) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()

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

  const {
    filter: filterRaw,
    error: errorParam,
    created: createdParam,
    showInternal: showInternalRaw,
  } = await searchParams
  const filter = filterRaw && isValidFilter(filterRaw) ? filterRaw : 'active'
  const showInternal = showInternalRaw === '1'
  const nowIso = new Date().toISOString()

  let query = supabase
    .from('activation_links')
    .select(
      'id, token, phone_target, amount, currency, status, kind, trial_days, created_at, expires_at, activated_at, activated_user_id',
    )
    .order('created_at', { ascending: false })
    .limit(50)

  if (filter === 'active') {
    query = query.eq('status', 'issued').gt('expires_at', nowIso)
  } else if (filter === 'expired') {
    query = query.or(`status.eq.expired,and(status.eq.issued,expires_at.lt.${nowIso})`)
  } else if (filter === 'activated') {
    query = query.eq('status', 'activated')
  }

  const { data: rawRows, error } = await query.returns<ActivationLinkListRow[]>()
  if (error) throw new Error(error.message)

  const { data: internalProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, phone, user_kind')
    .in('user_kind', ['staff', 'test'])
  if (profilesError) throw new Error(profilesError.message)

  const internalIndex = buildInternalUsersIndex(internalProfiles ?? [])

  const idsWithoutPhone = (internalProfiles ?? [])
    .filter((p) => !p.phone)
    .map((p) => p.id)
  if (idsWithoutPhone.length > 0) {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    })
    if (authError) throw new Error(authError.message)

    enrichInternalIndexWithPhones(
      internalIndex,
      authData.users
        .filter((u) => idsWithoutPhone.includes(u.id))
        .map((u) => ({
          userId: u.id,
          phone:
            typeof u.user_metadata?.phone_e164 === 'string'
              ? u.user_metadata.phone_e164
              : u.phone,
        })),
    )
  }

  const internalList = internalProfiles ?? []
  const rows = (rawRows ?? []).filter((row) =>
    shouldShowActivationLinkInList(row, internalIndex, internalList, showInternal),
  )

  const metrics = [
    { label: 'Создано', value: createdCount },
    { label: 'Открыто', value: openedCount },
    { label: 'Активировано', value: activatedCount },
    { label: 'Истекло', value: expiredCount },
    { label: 'Конверсия', value: `${(conversion * 100).toFixed(1)}%` },
  ]

  const filterTabs = [
    { id: 'active', label: 'Активные', href: buildListHref('active', showInternal) },
    { id: 'expired', label: 'Истекшие', href: buildListHref('expired', showInternal) },
    { id: 'activated', label: 'Активированные', href: buildListHref('activated', showInternal) },
    { id: 'all', label: 'Все', href: buildListHref('all', showInternal) },
  ]

  const internalToggleHref = showInternal
    ? buildListHref(filter, false)
    : buildListHref(filter, true)

  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] : null
  const successMessage = createdParam ? SUCCESS_MESSAGES[createdParam] : null

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ссылки активации</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Создайте платную ссылку после оплаты или выдайте пробный доступ на 14 дней. Срок действия
          любой ссылки — 24 часа. В списке по умолчанию только клиенты (без staff/test).
        </p>
      </div>

      {/* METRICS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metrics.map((m) => (
          <Card key={m.label} padding="sm">
            <p className="text-sm text-gray-400">{m.label} (7д)</p>
            <p className="mt-1 text-2xl font-bold">{m.value}</p>
          </Card>
        ))}
      </div>

      <p className="mb-6 text-sm text-gray-400">
        открыто/создано: {(openedPerCreated * 100).toFixed(1)}% · активаций/открыто: {(activatedPerOpened * 100).toFixed(1)}%
      </p>

      {/* MESSAGES */}
      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {/* CREATE FORMS */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {/* Paid */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Платная активация</h2>
            <Badge color="dark">PAID</Badge>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Создаётся после оплаты. Срок подписки — 30 дней.
          </p>
          <form action={createActivationLink} className="flex flex-col gap-4">
            <input type="hidden" name="kind" value="paid" />
            <div>
              <label htmlFor="phone_target_paid" className="mb-1.5 block text-base font-medium text-gray-700">
                Номер клиента
              </label>
              <PhoneInput
                id="phone_target_paid"
                name="phone_target"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="amount_paid" className="mb-1.5 block text-base font-medium text-gray-700">
                Сумма (₸)
              </label>
              <input
                id="amount_paid"
                name="amount"
                type="number"
                defaultValue={1990}
                min={1}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
              />
            </div>
            <Button type="submit" size="lg">Создать платную ссылку</Button>
          </form>
        </Card>

        {/* Trial */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Пробный доступ на 14 дней</h2>
            <Badge color="accent">TRIAL</Badge>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Пробный доступ: 14 дней. Выдаётся 1 раз на номер.
          </p>
          <form action={createActivationLink} className="flex flex-col gap-4">
            <input type="hidden" name="kind" value="trial" />
            <div>
              <label htmlFor="phone_target_trial" className="mb-1.5 block text-base font-medium text-gray-700">
                Номер клиента
              </label>
              <PhoneInput
                id="phone_target_trial"
                name="phone_target"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent"
              />
            </div>
            <Button type="submit" size="lg" variant="secondary">
              Выдать пробный доступ
            </Button>
          </form>
        </Card>
      </div>

      {/* FILTERS */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={filterTabs} active={filter} />
        <Link
          href={internalToggleHref}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showInternal ? 'Только клиенты' : 'Показать staff/test'}
        </Link>
      </div>

      {/* TABLE */}
      {!rows.length ? (
        <EmptyState
          title={showInternal ? 'Пока нет ссылок' : 'Нет ссылок для клиентов'}
          description={
            showInternal
              ? 'Создайте первую ссылку выше'
              : 'Ссылки staff/test скрыты. Включите «Показать staff/test» или создайте ссылку для клиента.'
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Телефон</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Сумма</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Статус</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Создана</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const displayKind = resolveActivationLinkDisplayKind(
                    row,
                    internalIndex,
                    internalList,
                  )
                  const url = buildActivationUrl(row.token)
                  const waHref = buildManagerWhatsAppHref(
                    row.phone_target,
                    url,
                    row.kind,
                    row.trial_days,
                  )
                  const isExpiredByTime = new Date(row.expires_at).getTime() < Date.now()
                  const isTrial = row.kind === 'trial'
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.phone_target}</span>
                          {showInternal ? (
                            <Badge color={activationLinkUserKindBadgeColor(displayKind)}>
                              {activationLinkUserKindBadgeLabel(displayKind)}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={isTrial ? 'accent' : 'dark'}>
                          {isTrial ? `TRIAL · ${row.trial_days ?? 14}д` : 'PAID'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {isTrial ? '—' : `${row.amount} ${row.currency}`}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={statusBadgeColor(row.status, isExpiredByTime)}>
                          {statusLabel(row.status)}
                          {isExpiredByTime && row.status === 'issued' ? ' (истёк)' : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(row.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CopyLinkButton
                            textToCopy={url}
                            className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          />
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
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
