import { requireAdmin } from '@/lib/admin'
import { createCustomerMetricsScope, type CustomerMetricsScope } from '@/lib/customer-metrics'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'
import { isKZNumber, normalizeToE164Like } from '@/lib/kz-phone'
import {
  aggregateMetricaBySource,
  SUPPORT_WHATSAPP_SOURCES,
} from '@/lib/whatsapp-analytics'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PRICE_KZT } from '@/lib/pricing'

/** Шаги TipTop-воронки (порядок для UI). */
const TIPTOP_FUNNEL_STEPS = [
  'cta_click',
  'checkout_open',
  'phone_filled',
  'pay_click',
  'widget_open',
  'purchase',
  'payment_fail',
  'payment_abandoned',
] as const

type TipTopFunnelStep = (typeof TIPTOP_FUNNEL_STEPS)[number]

const TIPTOP_STEP_LABELS: Record<TipTopFunnelStep, string> = {
  cta_click: 'CTA клик',
  checkout_open: 'Чекаут открыт',
  phone_filled: 'Телефон',
  pay_click: 'Оплатить',
  widget_open: 'Виджет',
  purchase: 'Оплата OK',
  payment_fail: 'Оплата fail',
  payment_abandoned: 'Бросил оплату',
}

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
  user_id: string
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
  event_name?: string
  created_at?: string
  meta: Record<string, unknown> | null
}

type MetricaGoalsDailyRow = {
  source: string
  achievements: number
  date: string
}

type TipTopFunnelStats = {
  steps: Record<TipTopFunnelStep, number>
  crPct: number | null
  bySource: Array<{ source: string; ctaClicks: number; payments: number; crPct: number | null }>
}

type SupportWhatsappStats = {
  total: number
  bySource: Array<{ source: string; clicks: number }>
}

function emptyTipTopSteps(): Record<TipTopFunnelStep, number> {
  return {
    cta_click: 0,
    checkout_open: 0,
    phone_filled: 0,
    pay_click: 0,
    widget_open: 0,
    purchase: 0,
    payment_fail: 0,
    payment_abandoned: 0,
  }
}

function aggregateTipTopFunnel(rows: AnalyticsEventRow[]): TipTopFunnelStats {
  const steps = emptyTipTopSteps()
  const ctaBySource = new Map<string, number>()
  const payBySource = new Map<string, number>()

  for (const row of rows) {
    const name = row.event_name
    if (!name || !(name in steps)) continue
    const step = name as TipTopFunnelStep
    steps[step]++

    const raw = row.meta?.source
    const source = typeof raw === 'string' && raw.length > 0 ? raw : '(без source)'
    if (step === 'cta_click') {
      ctaBySource.set(source, (ctaBySource.get(source) ?? 0) + 1)
    } else if (step === 'purchase') {
      payBySource.set(source, (payBySource.get(source) ?? 0) + 1)
    }
  }

  const sources = new Set([...ctaBySource.keys(), ...payBySource.keys()])
  const bySource = Array.from(sources)
    .map((source) => {
      const ctaClicks = ctaBySource.get(source) ?? 0
      const payments = payBySource.get(source) ?? 0
      return {
        source,
        ctaClicks,
        payments,
        crPct: ctaClicks > 0 ? Math.round((payments / ctaClicks) * 100) : null,
      }
    })
    .sort((a, b) => b.ctaClicks - a.ctaClicks || b.payments - a.payments)

  return {
    steps,
    crPct:
      steps.cta_click > 0
        ? Math.round((steps.purchase / steps.cta_click) * 100)
        : null,
    bySource,
  }
}

async function loadTipTopFunnel(scope: CustomerMetricsScope, daysAgo: number) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-daysAgo)
  return safe(async () => {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('id, user_id, event_name, meta')
      .in('event_name', [...TIPTOP_FUNNEL_STEPS])
      .gte('created_at', since)
      .returns<AnalyticsEventRow[]>()
    if (error) throw error

    return aggregateTipTopFunnel(scope.filterNullableUserRows(data ?? []))
  }, `tiptop_funnel_${daysAgo}d`)
}

async function loadSupportWhatsapp(scope: CustomerMetricsScope, daysAgo: number) {
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

    const bySource = new Map<string, number>()
    let total = 0
    for (const row of scope.filterNullableUserRows(data ?? [])) {
      const raw = row.meta?.source
      const source = typeof raw === 'string' && raw.length > 0 ? raw : '(без source)'
      if (!SUPPORT_WHATSAPP_SOURCES.has(source)) continue
      total++
      bySource.set(source, (bySource.get(source) ?? 0) + 1)
    }

    return {
      total,
      bySource: Array.from(bySource.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([source, clicks]) => ({ source, clicks })),
    } satisfies SupportWhatsappStats
  }, `support_whatsapp_${daysAgo}d`)
}

async function loadMetricaTipTopGoals(daysAgo: number) {
  const supabase = createSupabaseAdminClient()
  const since = isoDateUtc(-daysAgo)
  return safe(async () => {
    const { data, error } = await supabase
      .from('metrica_goals_daily')
      .select('source, achievements, date, goal_name')
      .in('goal_name', ['cta_click', 'purchase'])
      .gte('date', since)
      .returns<Array<MetricaGoalsDailyRow & { goal_name: string }>>()
    if (error) throw error

    let cta = 0
    let payment = 0
    const paymentRows: MetricaGoalsDailyRow[] = []
    for (const row of data ?? []) {
      if (row.goal_name === 'cta_click') cta += row.achievements
      if (row.goal_name === 'purchase') {
        payment += row.achievements
        paymentRows.push(row)
      }
    }

    const bySource = aggregateMetricaBySource(paymentRows)
    return {
      cta,
      payment,
      crPct: cta > 0 ? Math.round((payment / cta) * 100) : null,
      bySource,
    }
  }, `metrica_tiptop_${daysAgo}d`)
}

async function loadActiveSubscribers(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const today = isoDateUtc(0)
  return safe(async () => {
    const total = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('end_date', today),
    )
    if (total.error) throw total.error

    const paid = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('plan_type', 'paid')
        .gte('end_date', today),
    )
    if (paid.error) throw paid.error

    return { total: total.count ?? 0, paid: paid.count ?? 0 }
  }, 'active_subscribers')
}

async function loadNewSubscriptions(scope: CustomerMetricsScope, daysAgo: number) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-daysAgo)
  return safe(async () => {
    const total = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since),
    )
    if (total.error) throw total.error

    const paid = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('plan_type', 'paid')
        .gte('created_at', since),
    )
    if (paid.error) throw paid.error

    return { total: total.count ?? 0, paid: paid.count ?? 0 }
  }, `new_subscriptions_${daysAgo}d`)
}

async function loadRedemptions30d(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-30)
  return safe(async () => {
    const usersRes = await scope.applyUserIdExclusion(
      supabase.from('redemptions').select('id, user_id').gte('redeemed_at', since),
    ).returns<RedemptionUserRow[]>()
    if (usersRes.error) throw usersRes.error

    const rows = usersRes.data ?? []
    const uniqueUsers = new Set(rows.map((r) => r.user_id)).size

    return { total: rows.length, uniqueUsers }
  }, 'redemptions_30d')
}

async function loadTopRestaurants30d(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const since = isoTimestamp(-30)
  return safe(async () => {
    // Стратегия: тянем все redemptions за 30 дней (объём пока маленький),
    // группируем в JS, затем достаём имена топ-5 заведений.
    const rdRes = await scope.applyUserIdExclusion(
      supabase
        .from('redemptions')
        .select('restaurant_id, user_id')
        .gte('redeemed_at', since),
    ).returns<RedemptionForTop[]>()
    if (rdRes.error) throw rdRes.error

    const counts = new Map<string, number>()
    for (const row of scope.filterUserRows(rdRes.data ?? [])) {
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

async function loadExpiringSubscriptions(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const today = isoDateUtc(0)
  const in7 = isoDateUtc(7)
  return safe(async () => {
    const subRes = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('id, user_id, end_date, plan_type')
        .eq('status', 'active')
        .gte('end_date', today)
        .lte('end_date', in7)
        .order('end_date', { ascending: true }),
    ).returns<ExpiringRow[]>()
    if (subRes.error) throw subRes.error

    const rows = scope.filterUserRows(subRes.data ?? [])
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

async function loadRetention30d(scope: CustomerMetricsScope) {
  const supabase = createSupabaseAdminClient()
  const cohortStart = isoTimestamp(-60)
  const cohortEnd = isoTimestamp(-30)
  const today = isoDateUtc(0)
  return safe(async () => {
    // 1) Тянем всех подписчиков, чья первая подписка была 30-60 дней назад.
    //    Для определения "первой" — берём min(created_at) по user_id среди ВСЕХ
    //    подписок до cohortEnd, чтобы не записать в когорту тех, кто оформил
    //    раньше 60 дней назад, но получил вторую подписку в окне 30-60.
    const earlyRes = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('user_id, created_at')
        .lte('created_at', cohortEnd)
        .order('created_at', { ascending: true }),
    ).returns<SubscriptionRetentionRow[]>()
    if (earlyRes.error) throw earlyRes.error

    const firstByUser = new Map<string, string>()
    for (const row of scope.filterUserRows(earlyRes.data ?? [])) {
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
    const activeRes = await scope.applySubscriptionExclusion(
      supabase
        .from('subscriptions')
        .select('user_id')
        .in('user_id', cohort)
        .eq('status', 'active')
        .gte('end_date', today),
    ).returns<RedemptionUserRow[]>()
    if (activeRes.error) throw activeRes.error

    const stillActive = new Set(scope.filterUserRows(activeRes.data ?? []).map((r) => r.user_id))
      .size

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

  const admin = createSupabaseAdminClient()
  const scope = await createCustomerMetricsScope(admin)

  const [
    activeSubs,
    new7d,
    new30d,
    tipTop7d,
    tipTop30d,
    supportWa7d,
    metrica7d,
    redemptions30d,
    topRestaurants,
    expiring,
    retention,
  ] = await Promise.all([
    loadActiveSubscribers(scope),
    loadNewSubscriptions(scope, 7),
    loadNewSubscriptions(scope, 30),
    loadTipTopFunnel(scope, 7),
    loadTipTopFunnel(scope, 30),
    loadSupportWhatsapp(scope, 7),
    loadMetricaTipTopGoals(7),
    loadRedemptions30d(scope),
    loadTopRestaurants30d(scope),
    loadExpiringSubscriptions(scope),
    loadRetention30d(scope),
  ])

  // --- derived metrics ---
  const activeTotal: MetricValue<number> = activeSubs.ok
    ? { ok: true, value: activeSubs.value.total }
    : { ok: false }
  const activePaid: MetricValue<number> = activeSubs.ok
    ? { ok: true, value: activeSubs.value.paid }
    : { ok: false }

  const mrr: MetricValue<number> = activeSubs.ok
    ? { ok: true, value: activeSubs.value.paid * PRICE_KZT }
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

  function fmtPct(n: number | null | undefined): string {
    if (n == null) return '—'
    return `${n}%`
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Дашборд Kudaclub</h1>
        <p className="mt-1 text-base leading-6 text-gray-500">
          Внутренние метрики продукта (только customer, без staff/test). Обновляется при
          каждом заходе.
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
            label={`MRR (paid × ${PRICE_KZT})`}
            value={mrr.ok ? fmtKzt(mrr.value) : '—'}
            hint="только paid-подписки"
          />
        </div>
      </section>

      {/* БЛОК 2 — TIPTOP-ВОРОНКА */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">2. TipTop-воронка</h2>
        <p className="mb-3 text-sm text-gray-500">
          Live-данные из analytics_events (SubscribeCTA → CheckoutModal). За 7 и 30 дней.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="CTA клики (7д)"
            value={tipTop7d.ok ? fmtNumber(tipTop7d.value.steps.cta_click) : '—'}
            hint="cta_click"
          />
          <MetricCard
            label="Оплаты (7д)"
            value={tipTop7d.ok ? fmtNumber(tipTop7d.value.steps.purchase) : '—'}
            hint="purchase"
          />
          <MetricCard
            label="CR (7д)"
            value={tipTop7d.ok ? fmtPct(tipTop7d.value.crPct) : '—'}
            hint="purchase / cta_click"
          />
          <MetricCard
            label="CR (30д)"
            value={tipTop30d.ok ? fmtPct(tipTop30d.value.crPct) : '—'}
            hint="purchase / cta_click"
          />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">Шаги воронки (7 дней)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIPTOP_FUNNEL_STEPS.map((step) => (
              <MetricCard
                key={step}
                label={TIPTOP_STEP_LABELS[step]}
                value={tipTop7d.ok ? fmtNumber(tipTop7d.value.steps[step]) : '—'}
                hint={step}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            CTA → оплата по source (30 дней)
          </h3>
          <Card padding="none" className="overflow-hidden">
            {!tipTop30d.ok ? (
              <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
            ) : tipTop30d.value.bySource.length === 0 ? (
              <p className="px-4 py-6 text-center text-base text-gray-500">
                Пока нет событий воронки. Данные появятся после кликов SubscribeCTA.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-base">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">source</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">CTA</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Оплаты</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">CR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tipTop30d.value.bySource.map((row) => (
                      <tr key={row.source}>
                        <td className="px-4 py-3 font-mono text-sm text-gray-900">{row.source}</td>
                        <td className="px-4 py-3 tabular-nums">{fmtNumber(row.ctaClicks)}</td>
                        <td className="px-4 py-3 tabular-nums">{fmtNumber(row.payments)}</td>
                        <td className="px-4 py-3 tabular-nums text-gray-600">{fmtPct(row.crPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            Саппорт WhatsApp (7 дней)
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Кликов в саппорт"
              value={supportWa7d.ok ? fmtNumber(supportWa7d.value.total) : '—'}
              hint="whatsapp_click, только support sources"
            />
          </div>
          {supportWa7d.ok && supportWa7d.value.bySource.length > 0 ? (
            <Card padding="none" className="mt-3 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-left text-base">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">source</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Клики</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {supportWa7d.value.bySource.map((row) => (
                      <tr key={row.source}>
                        <td className="px-4 py-3 font-mono text-sm text-gray-900">{row.source}</td>
                        <td className="px-4 py-3 tabular-nums">{fmtNumber(row.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      </section>

      {/* БЛОК 3 — МЕТРИКА */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">3. Яндекс.Метрика</h2>
        <p className="mb-3 text-sm text-gray-500">
          Агрегаты из metrica_goals_daily (Слой 1). Обновляется cron раз в сутки (~03:00 Алматы).
          Нужны JS-цели с идентификаторами cta_click / purchase.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="cta_click (7д, Метрика)"
            value={metrica7d.ok ? fmtNumber(metrica7d.value.cta) : '—'}
            hint="официальная статистика"
          />
          <MetricCard
            label="purchase (7д, Метрика)"
            value={metrica7d.ok ? fmtNumber(metrica7d.value.payment) : '—'}
            hint="официальная статистика"
          />
          <MetricCard
            label="CR Метрика (7д)"
            value={metrica7d.ok ? fmtPct(metrica7d.value.crPct) : '—'}
            hint="purchase / cta"
          />
          <MetricCard
            label="CR Live (7д)"
            value={tipTop7d.ok ? fmtPct(tipTop7d.value.crPct) : '—'}
            hint="analytics_events для сравнения"
          />
        </div>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            purchase по source (7 дней, Метрика)
          </h3>
          <Card padding="none" className="overflow-hidden">
            {!metrica7d.ok ? (
              <p className="px-4 py-6 text-center text-base text-gray-400">— нет данных —</p>
            ) : metrica7d.value.bySource.length === 0 ? (
              <p className="px-4 py-6 text-center text-base text-gray-500">
                Нет данных Метрики за 7 дней. Создайте JS-цели TipTop и проверьте cron
                metrica-sync / YANDEX_OAUTH_TOKEN.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-base">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">source</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Достижения</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Доля</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {metrica7d.value.bySource.map((row) => {
                      const share =
                        metrica7d.value.payment > 0
                          ? Math.round((row.achievements / metrica7d.value.payment) * 100)
                          : 0
                      return (
                        <tr key={row.source}>
                          <td className="px-4 py-3 font-mono text-sm text-gray-900">
                            {row.source}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{fmtNumber(row.achievements)}</td>
                          <td className="px-4 py-3 tabular-nums text-gray-600">{share}%</td>
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

      {/* БЛОК 4 — АКТИВНОСТЬ */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">4. Активность за 30 дней</h2>
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

      {/* БЛОК 5 — ИСТЕКАЮЩИЕ */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          5. Подписки на исходе (ближайшие 7 дней)
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

      {/* БЛОК 6 — RETENTION */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">6. Retention 30 дней</h2>
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
