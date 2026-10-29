import { requireAdmin } from '@/lib/admin'
import { createCustomerMetricsScope, type CustomerMetricsScope } from '@/lib/customer-metrics'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ---------- helpers ----------

type MetricValue<T> =
  | { ok: true; value: T }
  | { ok: false }

async function safe<T>(fn: () => Promise<T>, context: string): Promise<MetricValue<T>> {
  try {
    const value = await fn()
    return { ok: true, value }
  } catch (error) {
    logServerError(`admin/dashboard:${context}`, error)
    return { ok: false }
  }
}

function isoTimestamp(daysOffset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysOffset)
  return d.toISOString()
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pct(part: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((part / total) * 100)}%`
}

// ---------- loaders ----------

async function loadGuests() {
  const supabase = createSupabaseAdminClient()
  return safe(async () => {
    const base = () =>
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('phone', 'is', null)
        .eq('user_kind', 'customer')

    const [total, new7, new30, founders] = await Promise.all([
      base(),
      base().gte('created_at', isoTimestamp(-7)),
      base().gte('created_at', isoTimestamp(-30)),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_founder', true),
    ])
    for (const res of [total, new7, new30, founders]) {
      if (res.error) throw res.error
    }
    return {
      total: total.count ?? 0,
      new7d: new7.count ?? 0,
      new30d: new30.count ?? 0,
      founders: founders.count ?? 0,
    }
  }, 'guests')
}

async function loadFunnel7d(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-7)
  return safe(async () => {
    const [eventsRes, tokensRes, redemptionsRes] = await Promise.all([
      supabase
        .from('analytics_events')
        .select('event_name, user_id')
        .in('event_name', ['login_cta_click', 'signup_completed'])
        .gte('created_at', since)
        .limit(50000),
      scope.applyUserIdExclusion(
        supabase.from('redeem_tokens').select('user_id').gte('issued_at', since).limit(50000),
      ),
      scope.applyUserIdExclusion(
        supabase.from('redemptions').select('user_id').gte('redeemed_at', since).limit(50000),
      ),
    ])
    if (eventsRes.error) throw eventsRes.error
    if (tokensRes.error) throw tokensRes.error
    if (redemptionsRes.error) throw redemptionsRes.error

    const events = scope.filterNullableUserRows(eventsRes.data ?? [])
    const tokens = (tokensRes.data ?? []) as Array<{ user_id: string }>
    const redemptions = (redemptionsRes.data ?? []) as Array<{ user_id: string }>

    return {
      loginClicks: events.filter((e) => e.event_name === 'login_cta_click').length,
      signups: events.filter((e) => e.event_name === 'signup_completed').length,
      codes: tokens.length,
      guestsWithCode: new Set(tokens.map((t) => t.user_id)).size,
      redemptions: redemptions.length,
    }
  }, 'funnel_7d')
}

async function loadActivity30d(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-30)
  return safe(async () => {
    const rdRes = await scope.applyUserIdExclusion(
      supabase
        .from('redemptions')
        .select('restaurant_id, user_id')
        .gte('redeemed_at', since)
        .limit(50000),
    )
    if (rdRes.error) throw rdRes.error

    const rows = scope.filterUserRows(
      (rdRes.data ?? []) as Array<{ restaurant_id: string; user_id: string }>,
    )
    const counts = new Map<string, number>()
    for (const row of rows) {
      counts.set(row.restaurant_id, (counts.get(row.restaurant_id) ?? 0) + 1)
    }

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    let topRestaurants: Array<{ name: string; uses: number }> = []
    if (top.length > 0) {
      const nameRes = await supabase
        .from('restaurants')
        .select('id, restaurant_name')
        .in('id', top.map(([id]) => id))
      if (nameRes.error) throw nameRes.error
      const nameById = new Map((nameRes.data ?? []).map((r) => [r.id, r.restaurant_name]))
      topRestaurants = top.map(([id, uses]) => ({
        name: nameById.get(id) ?? '— заведение удалено —',
        uses,
      }))
    }

    return {
      total: rows.length,
      uniqueGuests: new Set(rows.map((r) => r.user_id)).size,
      topRestaurants,
    }
  }, 'activity_30d')
}

async function loadTipTopSafety() {
  const supabase = createSupabaseAdminClient()
  return safe(async () => {
    const [webhooksRes, lastRunRes] = await Promise.all([
      supabase
        .from('analytics_events')
        .select('meta, created_at')
        .eq('event_name', 'tiptop_webhook_ignored')
        .gte('created_at', isoTimestamp(-30))
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('subscription_cancel_log')
        .select('run_id, dry_run, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ run_id: string; dry_run: boolean; created_at: string }>(),
    ])
    if (webhooksRes.error) throw webhooksRes.error
    if (lastRunRes.error) throw lastRunRes.error

    const webhooks = (webhooksRes.data ?? []) as Array<{
      meta: Record<string, unknown> | null
      created_at: string
    }>
    const charges = webhooks.filter((w) => {
      const amount = Number(String(w.meta?.Amount ?? '').replace(',', '.'))
      return w.meta?.kind === 'pay' && w.meta?.verified === true && amount > 0
    })

    let lastRun: {
      at: string
      dryRun: boolean
      results: Record<string, number>
    } | null = null
    if (lastRunRes.data) {
      const runRows = await supabase
        .from('subscription_cancel_log')
        .select('result')
        .eq('run_id', lastRunRes.data.run_id)
      if (runRows.error) throw runRows.error
      const results: Record<string, number> = {}
      for (const row of runRows.data ?? []) {
        results[row.result] = (results[row.result] ?? 0) + 1
      }
      lastRun = {
        at: lastRunRes.data.created_at,
        dryRun: lastRunRes.data.dry_run,
        results,
      }
    }

    return {
      webhooks30d: webhooks.length,
      charges30d: charges.length,
      lastChargeAt: charges[0]?.created_at ?? null,
      lastRun,
    }
  }, 'tiptop_safety')
}

async function loadWhatsapp7d(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  return safe(async () => {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('user_id, meta')
      .eq('event_name', 'whatsapp_click')
      .gte('created_at', isoTimestamp(-7))
      .limit(20000)
    if (error) throw error

    const bySource = new Map<string, number>()
    const rows = scope.filterNullableUserRows(
      (data ?? []) as Array<{ user_id: string | null; meta: Record<string, unknown> | null }>,
    )
    for (const row of rows) {
      const raw = row.meta?.source
      const source = typeof raw === 'string' && raw.length > 0 ? raw : '(без source)'
      bySource.set(source, (bySource.get(source) ?? 0) + 1)
    }
    return {
      total: rows.length,
      bySource: Array.from(bySource.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([source, clicks]) => ({ source, clicks })),
    }
  }, 'whatsapp_7d')
}

// ---------- UI primitives ----------

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <Card padding="md">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </Card>
  )
}

function show<T>(m: MetricValue<T>, pick: (v: T) => number): React.ReactNode {
  return m.ok ? fmtNumber(pick(m.value)) : '—'
}

const CANCEL_RESULT_LABELS: Record<string, string> = {
  would_cancel: 'к отмене',
  cancelled: 'отменено',
  skipped: 'пропущено',
  error: 'ошибки',
}

// ---------- page ----------

export default async function AdminDashboardPage() {
  await requireAdmin()

  const admin = createSupabaseAdminClient()
  const scope = await createCustomerMetricsScope(admin)

  const [guests, funnel, activity, tiptop, whatsapp] = await Promise.all([
    loadGuests(),
    loadFunnel7d(scope),
    loadActivity30d(scope),
    loadTipTopSafety(),
    loadWhatsapp7d(scope),
  ])

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Дашборд Kudaclub</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Внутренние метрики продукта (только customer, без staff/test). Обновляется при
          каждом заходе.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">1. Гости</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="С подтверждённым телефоном"
            value={show(guests, (v) => v.total)}
          />
          <MetricCard label="Новых за 7 дней" value={show(guests, (v) => v.new7d)} />
          <MetricCard label="Новых за 30 дней" value={show(guests, (v) => v.new30d)} />
          <MetricCard
            label="Основатели клуба"
            value={show(guests, (v) => v.founders)}
            hint="бывшие подписчики"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">2. Воронка за 7 дней</h2>
        <p className="mb-3 text-sm text-gray-500">
          Клик «Получить доступ» → регистрация → код → подтверждение персоналом.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Клики «Получить доступ»"
            value={show(funnel, (v) => v.loginClicks)}
            hint="login_cta_click"
          />
          <MetricCard
            label="Регистрации"
            value={show(funnel, (v) => v.signups)}
            hint="signup_completed"
          />
          <MetricCard
            label="Выдано кодов"
            value={show(funnel, (v) => v.codes)}
            hint={funnel.ok ? `гостей: ${fmtNumber(funnel.value.guestsWithCode)}` : undefined}
          />
          <MetricCard
            label="Использовано"
            value={show(funnel, (v) => v.redemptions)}
            hint={
              funnel.ok
                ? `код → использование: ${pct(funnel.value.redemptions, funnel.value.codes)}`
                : undefined
            }
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">3. Активность за 30 дней</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Использовали хотя бы 1 оффер"
            value={show(activity, (v) => v.uniqueGuests)}
            hint="уникальные гости"
          />
          <MetricCard
            label="Всего использований"
            value={show(activity, (v) => v.total)}
            hint="включая повторные"
          />
          <MetricCard
            label="Доля активных"
            value={
              activity.ok && guests.ok
                ? pct(activity.value.uniqueGuests, guests.value.total)
                : '—'
            }
            hint="использовавшие / все гости с телефоном"
          />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">Топ-5 заведений по использованию</h3>
          <Card padding="none" className="overflow-hidden">
            {!activity.ok ? (
              <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
            ) : activity.value.topRestaurants.length === 0 ? (
              <p className="px-4 py-6 text-center text-base text-gray-500">
                За последние 30 дней использований не было.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {activity.value.topRestaurants.map((r, idx) => (
                  <li
                    key={`${r.name}-${idx}`}
                    className="flex items-center justify-between px-4 py-3 text-base"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-sm font-medium text-gray-400">{idx + 1}.</span>
                      <span className="font-medium text-gray-900">{r.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{fmtNumber(r.uses)} использ.</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">4. Страховка TipTop</h2>
        <p className="mb-3 text-sm text-gray-500">
          Оплаты отключены. Вебхуки только журналируются; списание после отключения — повод
          сделать возврат и запустить cancel-all-subscriptions.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Вебхуков за 30 дней"
            value={show(tiptop, (v) => v.webhooks30d)}
          />
          <MetricCard
            label="Списаний после отключения"
            value={
              tiptop.ok ? (
                <span className={tiptop.value.charges30d > 0 ? 'text-red-600' : undefined}>
                  {fmtNumber(tiptop.value.charges30d)}
                </span>
              ) : (
                '—'
              )
            }
            hint={
              tiptop.ok && tiptop.value.lastChargeAt
                ? `последнее: ${fmtDateTime(tiptop.value.lastChargeAt)}`
                : '30 дней, подписанные Pay с суммой'
            }
          />
          <MetricCard
            label="Последний прогон отмены"
            value={
              tiptop.ok && tiptop.value.lastRun
                ? tiptop.value.lastRun.dryRun
                  ? 'проверка'
                  : 'отмена'
                : '—'
            }
            hint={
              tiptop.ok && tiptop.value.lastRun
                ? `${fmtDateTime(tiptop.value.lastRun.at)} · ${Object.entries(
                    tiptop.value.lastRun.results,
                  )
                    .map(([k, n]) => `${CANCEL_RESULT_LABELS[k] ?? k}: ${n}`)
                    .join(', ')}`
                : 'ещё не запускали'
            }
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">5. WhatsApp за 7 дней</h2>
        <Card padding="none" className="overflow-hidden">
          {!whatsapp.ok ? (
            <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
          ) : whatsapp.value.bySource.length === 0 ? (
            <p className="px-4 py-6 text-center text-base text-gray-500">Кликов не было.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <tbody className="divide-y divide-gray-50">
                  {whatsapp.value.bySource.map((row) => (
                    <tr key={row.source}>
                      <td className="px-4 py-2 font-mono text-sm text-gray-900">{row.source}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {fmtNumber(row.clicks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
