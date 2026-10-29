import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { Card } from '@/components/ui/card'
import {
  loadAdminAnalytics,
  parsePeriodDays,
  PERIOD_OPTIONS,
  type AnalyticsPeriodDays,
} from '@/lib/admin-analytics'
import { AnalyticsCharts } from './charts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Аналитика — Kudaclub Admin',
  robots: { index: false, follow: false },
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

function fmtKzt(n: number): string {
  return `${fmtNumber(n)} ₸`
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  await requireAdmin('/admin/analytics')
  const sp = await searchParams
  const periodDays = parsePeriodDays(sp.days)
  const data = await loadAdminAnalytics(periodDays)
  const { realtime, efficiency, series } = data

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Аналитика гостей
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Регистрации — профили с подтверждённым телефоном; коды — redeem_tokens;
            использования — подтверждения персоналом. Без staff и тестовых.
          </p>
        </div>
        <PeriodTabs current={periodDays} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Сейчас
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Гостей с телефоном" value={fmtNumber(realtime.members)} />
          <MetricCard label="Регистрации сегодня" value={fmtNumber(realtime.signupsToday)} />
          <MetricCard label="Регистрации за 7 дней" value={fmtNumber(realtime.signups7d)} />
          <MetricCard label="Коды сегодня" value={fmtNumber(realtime.codesToday)} />
          <MetricCard
            label="Использования сегодня"
            value={fmtNumber(realtime.redemptionsToday)}
          />
          <MetricCard
            label="Активные гости"
            value={fmtNumber(realtime.activeGuests30d)}
            hint="с использованием за 30 дней"
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Эффективность · {periodDays} дней
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Расход на рекламу" value={fmtKzt(efficiency.spend)} />
          <MetricCard label="Регистрации" value={fmtNumber(efficiency.signups)} />
          <MetricCard
            label="Цена регистрации"
            value={efficiency.costPerSignup == null ? '—' : fmtKzt(efficiency.costPerSignup)}
            hint="расход / регистрации"
          />
          <MetricCard label="Выдано кодов" value={fmtNumber(efficiency.codes)} />
          <MetricCard label="Использования" value={fmtNumber(efficiency.redemptions)} />
          <MetricCard
            label="Код → использование"
            value={fmtPct(efficiency.codeToRedeem)}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Графики · {periodDays} дней
        </h2>
        <AnalyticsCharts series={series} />
      </section>
    </div>
  )
}

function PeriodTabs({ current }: { current: AnalyticsPeriodDays }) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
      {PERIOD_OPTIONS.map((days) => {
        const active = days === current
        return (
          <Link
            key={days}
            href={`/admin/analytics?days=${days}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-neutral-900 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {days}д
          </Link>
        )
      })}
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </Card>
  )
}
