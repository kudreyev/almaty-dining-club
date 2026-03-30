import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { buildActivationUrl } from '@/lib/activation-links'
import { createActivationLink } from './actions'
import { CopyLinkButton } from '@/components/copy-link-button'
import { PhoneInput } from '@/components/phone-input'
import { formatKZPhone } from '@/lib/kz-phone'

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
  } else {
    // all
  }

  const { data: rows, error } = await query.returns<ActivationLinkListRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin · Ссылки активации</h1>
            <p className="mt-2 text-sm text-gray-600">
              Создайте одноразовую ссылку для клиента после оплаты. Срок действия — 24 часа.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/restaurants"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Заведения
            </Link>
            <Link
              href="/admin/payments"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Оплаты
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">created (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{createdCount}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">opened (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{openedCount}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">activated (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{activatedCount}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">expired (7d)</p>
            <p className="mt-1 text-2xl font-semibold">{expiredCount}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-5">
            <p className="text-sm text-gray-500">conversion</p>
            <p className="mt-1 text-2xl font-semibold">{(conversion * 100).toFixed(1)}%</p>
            <p className="mt-2 text-xs text-gray-500">
              opened/created: {(openedPerCreated * 100).toFixed(1)}% · activated/opened:{' '}
              {(activatedPerOpened * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {errorParam === 'invalid_phone' ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Укажите полный номер Казахстана: 10 цифр после +7 (маска +7 (7xx) xxx xxxx).
          </div>
        ) : null}

        <form action={createActivationLink} className="mt-8 grid gap-4 rounded-2xl border border-gray-200 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="phone_target" className="mb-2 block text-sm font-medium text-gray-700">
              Номер клиента
            </label>
            <PhoneInput id="phone_target" name="phone_target" required />
          </div>
          <div>
            <label htmlFor="amount" className="mb-2 block text-sm font-medium text-gray-700">
              Сумма (〒)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              defaultValue={4990}
              min={1}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white md:self-end"
          >
            Создать
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {(
            [
              { id: 'active', label: 'Активные' },
              { id: 'expired', label: 'Истекшие' },
              { id: 'activated', label: 'Активированные' },
              { id: 'all', label: 'Все' },
            ] as const
          ).map((t) => {
            const isActive = filter === t.id
            return (
              <Link
                key={t.id}
                href={`/admin/activation-links?filter=${t.id}`}
                className={
                  isActive
                    ? 'rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white'
                    : 'rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black'
                }
              >
                {t.label}
              </Link>
            )
          })}
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-3 pr-4 font-medium">Телефон</th>
                <th className="py-3 pr-4 font-medium">Сумма</th>
                <th className="py-3 pr-4 font-medium">Статус</th>
                <th className="py-3 pr-4 font-medium">Создана</th>
                <th className="py-3 pr-4 font-medium">Истекает</th>
                <th className="py-3 pr-4 font-medium">Активирована</th>
                <th className="py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows?.length ? (
                rows.map((row) => {
                  const url = buildActivationUrl(row.token)
                  const waHref = buildManagerWhatsAppHref(row.phone_target, url)
                  const isExpiredByTime = new Date(row.expires_at).getTime() < Date.now()
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium">{formatKZPhone(row.phone_target)}</td>
                      <td className="py-3 pr-4">
                        {row.amount} {row.currency}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.status}</span>
                          {isExpiredByTime ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              expired
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(row.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(row.expires_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {row.activated_at ? new Date(row.activated_at).toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-2">
                          <code className="max-w-[240px] truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700">
                            {url}
                          </code>
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex w-fit rounded-2xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-black"
                            >
                              Отправить в WhatsApp
                            </a>
                            <CopyLinkButton
                              textToCopy={url}
                              className="inline-flex w-fit rounded-2xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-black disabled:opacity-70"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Пока нет ссылок. Создайте первую выше.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
