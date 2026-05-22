import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'
import { isKZNumber, normalizeToE164Like } from '@/lib/kz-phone'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Месячная цена подписки. Если поменяется тариф — поменять здесь.
const MONTHLY_PRICE_KZT = 1990

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

function isoDateUtc(daysOffset: number): string {
  // ISO YYYY-MM-DD для сравнения с полем date в Postgres.
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysOffset)
  return d.toISOString().slice(0, 10)
}

function isoTimestamp(daysOffset: number): string {
  // ISO timestamp для сравнения с created_at/redeemed_at (timestamptz).
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysOffset)
  return d.toISOString()
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function fmtKzt(n: number): string {
  return `${fmtNumber(n)} ₸`
}

function fmtDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function daysUntil(endDateIso: string): number {
  // endDateIso приходит как 'YYYY-MM-DD' (date). Считаем дни до конца включительно в UTC.
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const [yStr, mStr, dStr] = endDateIso.split('-')
  const end = Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr))
  return Math.max(0, Math.ceil((end - todayUtc) / 86_400_000))
}

/** Маска телефона: +7 706 *** ** 99 для KZ-номера, иначе грубая маска по последним 2 цифрам. */
function maskPhone(raw: string | null | undefined): string {
  if (!raw) return '—'
  const norm = normalizeToE164Like(raw)
  if (norm && isKZNumber(norm)) {
    const digits = norm.slice(1) // 11 цифр, начинается с 7
    return `+7 ${digits.slice(1, 4)} *** ** ${digits.slice(9, 11)}`
  }
  const digits = (raw.match(/\d+/g) ?? []).join('')
  if (digits.length < 2) return '***'
  return `*** ** ${digits.slice(-2)}`
}

// ---------- types ----------

type ExpiringRow = {
  id: string
  user_id: string
  end_date: string
  plan_type: 'paid' | 'trial'
}

type ProfilePhone = {
  id: string
  phone: string | null
}

type RedemptionForTop = {
  restaurant_id: string
}

type RestaurantNameRow = {
  id: string
  restaurant_name: string
}

type RedemptionUserRow = {
  user_id: string
}

type SubscriptionRetentionRow = {
  user_id: string
  created_at: string
}

type AnalyticsEventRow = {
  id: string
  user_id: string | null
  meta: Record<string, unknown> | null
}

const SUPPORT_WHATSAPP_SOURCES = new Set([
  'footer-support',
  'support-page',
  'support-phone',
  'activate-error',
  'activate-already-used',
  'activate-card-error',
  'activate-card-intro',
])

type WhatsappFunnelStats = {
  total: number
  subscribeClicks: number
  supportClicks: number
  bySource: Array<{ source: string; clicks: number }>
}

function aggregateWhatsappFunnel(rows: AnalyticsEventRow[]): WhatsappFunnelStats {
  const bySource = new Map<string, number>()
  let subscribeClicks = 0
  let supportClicks = 0

  for (const row of rows) {
    const raw = row.meta?.source
    const source = typeof raw === 'string' && raw.length > 0 ? raw : '(без source)'
    bySource.set(source, (bySource.get(source) ?? 0) + 1)
    if (SUPPORT_WHATSAPP_SOURCES.has(source)) {
      supportClicks++
    } else {
      subscribeClicks++
    }
  }

  return {
    total: rows.length,
    subscribeClicks,
    supportClicks,
    bySource: Array.from(bySource.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, clicks]) => ({ source, clicks })),
  }
}

async function loadWhatsappFunnel(daysAgo: number) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-daysAgo)
  return safe(async () => {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('id, user_id, meta')
      .eq('event_name', 'whatsapp_click')
      .gte('created_at', since)
      .returns<AnalyticsEventRow[]>()
    if (error) throw error

    return aggregateWhatsappFunnel(data ?? [])
  }, `whatsapp_funnel_${daysAgo}d`)
}

async function loadActiveSubscribers() {
  const supabase = createSupabaseAdminClient()
  const today = isoDateUtc(0)
  return safe(async () => {
    const total = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('end_date', today)
    if (total.error) throw total.error

    const paid = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('plan_type', 'paid')
      .gte('end_date', today)
    if (paid.error) throw paid.error

    return { total: total.count ?? 0, paid: paid.count ?? 0 }
  }, 'active_subscribers')
}

async function loadNewSubscriptions(daysAgo: number) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-daysAgo)
  return safe(async () => {
    const total = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
    if (total.error) throw total.error

    const paid = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_type', 'paid')
      .gte('created_at', since)
    if (paid.error) throw paid.error

    return { total: total.count ?? 0, paid: paid.count ?? 0 }
  }, `new_subscriptions_${daysAgo}d`)
}

async function loadRedemptions30d() {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-30)
  return safe(async () => {
    const totalRes = await supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .gte('redeemed_at', since)
    if (totalRes.error) throw totalRes.error

    const usersRes = await supabase
      .from('redemptions')
      .select('user_id')
      .gte('redeemed_at', since)
      .returns<RedemptionUserRow[]>()
    if (usersRes.error) throw usersRes.error

    const uniqueUsers = new Set((usersRes.data ?? []).map((r) => r.user_id)).size

    return { total: totalRes.count ?? 0, uniqueUsers }
  }, 'redemptions_30d')
}

async function loadTopRestaurants30d() {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-30)
  return safe(async () => {
    // Стратегия: тянем все redemptions за 30 дней (объём пока маленький),
    // группируем в JS, затем достаём имена топ-5 заведений.
    const rdRes = await supabase
      .from('redemptions')
      .select('restaurant_id')
      .gte('redeemed_at', since)
      .returns<RedemptionForTop[]>()
    if (rdRes.error) throw rdRes.error

    const counts = new Map<string, number>()
    for (const row of rdRes.data ?? []) {
      counts.set(row.restaurant_id, (counts.get(row.restaurant_id) ?? 0) + 1)
    }

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    if (top.length === 0) return [] as { name: string; uses: number }[]

    const nameRes = await supabase
      .from('restaurants')
      .select('id, restaurant_name')
      .in('id', top.map(([id]) => id))
      .returns<RestaurantNameRow[]>()
    if (nameRes.error) throw nameRes.error

    const nameById = new Map((nameRes.data ?? []).map((r) => [r.id, r.restaurant_name]))
    return top.map(([id, uses]) => ({
      name: nameById.get(id) ?? '— заведение удалено —',
      uses,
    }))
  }, 'top_restaurants_30d')
}

async function loadExpiringSubscriptions() {
  const supabase = createSupabaseAdminClient()
  const today = isoDateUtc(0)
  const in7 = isoDateUtc(7)
  return safe(async () => {
    const subRes = await supabase
      .from('subscriptions')
      .select('id, user_id, end_date, plan_type')
      .eq('status', 'active')
      .gte('end_date', today)
      .lte('end_date', in7)
      .order('end_date', { ascending: true })
      .returns<ExpiringRow[]>()
    if (subRes.error) throw subRes.error

    const rows = subRes.data ?? []
    if (rows.length === 0) return [] as Array<ExpiringRow & { phone: string | null }>

    const profRes = await supabase
      .from('profiles')
      .select('id, phone')
      .in('id', rows.map((r) => r.user_id))
      .returns<ProfilePhone[]>()
    if (profRes.error) throw profRes.error

    const phoneById = new Map((profRes.data ?? []).map((p) => [p.id, p.phone]))
    return rows.map((r) => ({ ...r, phone: phoneById.get(r.user_id) ?? null }))
  }, 'expiring_subscriptions')
}

async function loadRetention30d() {
  const supabase = createSupabaseAdminClient()
  const cohortStart = isoTimestamp(-60)
  const cohortEnd = isoTimestamp(-30)
  const today = isoDateUtc(0)
  return safe(async () => {
    // 1) Тянем всех подписчиков, чья первая подписка была 30-60 дней назад.
    //    Для определения "первой" — берём min(created_at) по user_id среди ВСЕХ
    //    подписок до cohortEnd, чтобы не записать в когорту тех, кто оформил
    //    раньше 60 дней назад, но получил вторую подписку в окне 30-60.
    const earlyRes = await supabase
      .from('subscriptions')
      .select('user_id, created_at')
      .lte('created_at', cohortEnd)
      .order('created_at', { ascending: true })
      .returns<SubscriptionRetentionRow[]>()
    if (earlyRes.error) throw earlyRes.error

    const firstByUser = new Map<string, string>()
    for (const row of earlyRes.data ?? []) {
      if (!firstByUser.has(row.user_id)) firstByUser.set(row.user_id, row.created_at)
    }

    const cohort: string[] = []
    for (const [userId, firstCreatedAt] of firstByUser) {
      if (firstCreatedAt >= cohortStart && firstCreatedAt <= cohortEnd) {
        cohort.push(userId)
      }
    }

    if (cohort.length === 0) {
      return { cohortSize: 0, stillActive: 0 }
    }

    // 2) Из когорты — сколько имеют активную подписку прямо сейчас.
    const activeRes = await supabase
      .from('subscriptions')
      .select('user_id')
      .in('user_id', cohort)
      .eq('status', 'active')
      .gte('end_date', today)
      .returns<RedemptionUserRow[]>()
    if (activeRes.error) throw activeRes.error

    const stillActive = new Set((activeRes.data ?? []).map((r) => r.user_id)).size

    return { cohortSize: cohort.length, stillActive }
  }, 'retention_30d')
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

function renderCount(m: MetricValue<number>): React.ReactNode {
  return m.ok ? fmtNumber(m.value) : '—'
}

function renderNewBlock(m: MetricValue<{ total: number; paid: number }>): {
  value: React.ReactNode
  hint: React.ReactNode
} {
  if (!m.ok) return { value: '—', hint: 'нет данных' }
  return {
    value: fmtNumber(m.value.total),
    hint: `из них paid: ${fmtNumber(m.value.paid)}`,
  }
}

// ---------- page ----------

export default async function AdminDashboardPage() {
  await requireAdmin()

  const [
    activeSubs,
    new7d,
    new30d,
    whatsapp7d,
    whatsapp30d,
    redemptions30d,
    topRestaurants,
    expiring,
    retention,
  ] = await Promise.all([
    loadActiveSubscribers(),
    loadNewSubscriptions(7),
    loadNewSubscriptions(30),
    loadWhatsappFunnel(7),
    loadWhatsappFunnel(30),
    loadRedemptions30d(),
    loadTopRestaurants30d(),
    loadExpiringSubscriptions(),
    loadRetention30d(),
  ])

  // --- derived metrics ---
  const activeTotal: MetricValue<number> = activeSubs.ok
    ? { ok: true, value: activeSubs.value.total }
    : { ok: false }
  const activePaid: MetricValue<number> = activeSubs.ok
    ? { ok: true, value: activeSubs.value.paid }
    : { ok: false }

  const mrr: MetricValue<number> = activeSubs.ok
    ? { ok: true, value: activeSubs.value.paid * MONTHLY_PRICE_KZT }
    : { ok: false }

  const activeRedeemers: MetricValue<number> = redemptions30d.ok
    ? { ok: true, value: redemptions30d.value.uniqueUsers }
    : { ok: false }

  const totalRedemptions30d: MetricValue<number> = redemptions30d.ok
    ? { ok: true, value: redemptions30d.value.total }
    : { ok: false }

  // Процент активации = уникальные использовавшие за 30 дней / активные подписчики сейчас.
  const activationRate: MetricValue<number> =
    redemptions30d.ok && activeSubs.ok && activeSubs.value.total > 0
      ? {
          ok: true,
          value: Math.round((redemptions30d.value.uniqueUsers / activeSubs.value.total) * 100),
        }
      : redemptions30d.ok && activeSubs.ok && activeSubs.value.total === 0
        ? { ok: true, value: 0 }
        : { ok: false }

  const new7 = renderNewBlock(new7d)
  const new30 = renderNewBlock(new30d)

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Дашборд Kudaclub</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Внутренние метрики продукта. Обновляется при каждом заходе.
        </p>
      </div>

      {/* БЛОК 1 — ПОДПИСЧИКИ */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">1. Подписчики</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Активных сейчас"
            value={renderCount(activeTotal)}
            hint={activePaid.ok ? `из них paid: ${fmtNumber(activePaid.value)}` : undefined}
          />
          <MetricCard
            label="Новых за 7 дней"
            value={new7.value}
            hint={new7.hint}
          />
          <MetricCard
            label="Новых за 30 дней"
            value={new30.value}
            hint={new30.hint}
          />
          <MetricCard
            label="MRR (paid × 1990)"
            value={mrr.ok ? fmtKzt(mrr.value) : '—'}
            hint="только paid-подписки"
          />
        </div>
      </section>

      {/* БЛОК 2 — WHATSAPP-ВОРОНКА */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">2. WhatsApp-воронка</h2>
        <p className="mb-3 text-sm text-gray-500">
          Live-данные из analytics_events (Слой 2). Обновляется при каждом клике на сайте.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Кликов за 7 дней"
            value={whatsapp7d.ok ? fmtNumber(whatsapp7d.value.total) : '—'}
            hint="whatsapp_click, все источники"
          />
          <MetricCard
            label="Подписные CTA"
            value={whatsapp7d.ok ? fmtNumber(whatsapp7d.value.subscribeClicks) : '—'}
            hint="без саппортных ссылок"
          />
          <MetricCard
            label="Саппорт"
            value={whatsapp7d.ok ? fmtNumber(whatsapp7d.value.supportClicks) : '—'}
            hint="footer, /support, /activate"
          />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            Разбивка по source (30 дней)
          </h3>
          <Card padding="none" className="overflow-hidden">
            {!whatsapp30d.ok ? (
              <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
            ) : whatsapp30d.value.bySource.length === 0 ? (
              <p className="px-4 py-6 text-center text-base text-gray-500">
                Пока нет кликов. Данные появятся после первых WhatsApp-кнопок на сайте.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-base">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">source</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Клики</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Доля</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {whatsapp30d.value.bySource.map((row) => {
                      const isSupport = SUPPORT_WHATSAPP_SOURCES.has(row.source)
                      const share =
                        whatsapp30d.value.total > 0
                          ? Math.round((row.clicks / whatsapp30d.value.total) * 100)
                          : 0
                      return (
                        <tr key={row.source}>
                          <td className="px-4 py-3 font-mono text-sm text-gray-900">
                            {row.source}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{fmtNumber(row.clicks)}</td>
                          <td className="px-4 py-3 tabular-nums text-gray-600">{share}%</td>
                          <td className="px-4 py-3">
                            <Badge color={isSupport ? 'yellow' : 'green'}>
                              {isSupport ? 'саппорт' : 'подписка'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* БЛОК 3 — АКТИВНОСТЬ */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">3. Активность за 30 дней</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Использовали хотя бы 1 оффер"
            value={renderCount(activeRedeemers)}
            hint="уникальные подписчики"
          />
          <MetricCard
            label="Всего использований"
            value={renderCount(totalRedemptions30d)}
            hint="включая повторные"
          />
          <MetricCard
            label="Процент активации"
            value={activationRate.ok ? `${activationRate.value}%` : '—'}
            hint="использовавшие / активные подписчики"
          />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">Топ-5 заведений по использованию</h3>
          <Card padding="none" className="overflow-hidden">
            {!topRestaurants.ok ? (
              <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
            ) : topRestaurants.value.length === 0 ? (
              <p className="px-4 py-6 text-center text-base text-gray-500">
                За последние 30 дней использований не было.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {topRestaurants.value.map((r, idx) => (
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

      {/* БЛОК 4 — ИСТЕКАЮЩИЕ */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          4. Подписки на исходе (ближайшие 7 дней)
        </h2>
        <Card padding="none" className="overflow-hidden">
          {!expiring.ok ? (
            <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
          ) : expiring.value.length === 0 ? (
            <p className="px-4 py-6 text-center text-base text-gray-500">
              На ближайшую неделю нечего продлевать.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-base">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Телефон</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Истекает</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Осталось</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expiring.value.map((row) => {
                    const left = daysUntil(row.end_date)
                    const isTrial = row.plan_type === 'trial'
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium tabular-nums">{maskPhone(row.phone)}</td>
                        <td className="px-4 py-3">
                          <Badge color={isTrial ? 'accent' : 'dark'}>
                            {isTrial ? 'TRIAL' : 'PAID'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{fmtDate(row.end_date)}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {left === 0 ? 'сегодня' : `${left} дн.`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* БЛОК 5 — RETENTION */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">5. Retention 30 дней</h2>
        <Card padding="md">
          {!retention.ok ? (
            <p className="text-base text-gray-400">— нет данных —</p>
          ) : retention.value.cohortSize === 0 ? (
            <p className="text-base text-gray-500">
              Недостаточно данных. Retention появится, когда первая когорта подписчиков пройдёт 30 дней.
            </p>
          ) : (
            <div className="flex items-baseline gap-4">
              <p className="text-3xl font-bold tracking-tight">
                {Math.round((retention.value.stillActive / retention.value.cohortSize) * 100)}%
              </p>
              <p className="text-sm text-gray-500">
                {fmtNumber(retention.value.stillActive)} из{' '}
                {fmtNumber(retention.value.cohortSize)} подписчиков, чья первая подписка была
                30–60 дней назад, имеют активную подписку сейчас.
              </p>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
