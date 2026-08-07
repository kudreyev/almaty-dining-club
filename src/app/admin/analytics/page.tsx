import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { Card } from '@/components/ui/card'
import {
  CAC_STOP_THRESHOLD,
  loadAdminAnalytics,
  parsePeriodDays,
  PERIOD_OPTIONS,
  MONTHLY_PRICE_KZT,
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
  const { realtime, efficiency, channels, series } = data

  const cacHot =
    efficiency.cac != null && efficiency.cac > CAC_STOP_THRESHOLD
  const cacOk =
    efficiency.cac != null && efficiency.cac <= CAC_STOP_THRESHOLD

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Аналитика подписок
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Источник правды: TipTop webhooks → subscribers / payments. Цена:{' '}
            {fmtKzt(MONTHLY_PRICE_KZT)}/мес.
          </p>
        </div>
        <PeriodTabs current={periodDays} />
      </div>

      {/* Realtime */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Сейчас
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard label="Активные" value={fmtNumber(realtime.active)} />
          <MetricCard label="MRR" value={fmtKzt(realtime.mrr)} />
          <MetricCard label="Новые сегодня" value={fmtNumber(realtime.newToday)} />
          <MetricCard label="Новые за 7 дней" value={fmtNumber(realtime.new7d)} />
          <MetricCard
            label="Отмены за 30 дней"
            value={fmtNumber(realtime.cancelled30d)}
          />
          <MetricCard
            label="Churn 30 дней"
            value={fmtPct(realtime.churn30d)}
          />
          <MetricCard
            label="Офферы сегодня"
            value={fmtNumber(realtime.redemptionsToday)}
            hint="использований"
          />
        </div>
      </section>

      {/* Efficiency */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Эффективность · {periodDays} дней
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Расход" value={fmtKzt(efficiency.spend)} />
          <Card
            className={
              cacHot
                ? 'border-red-300 bg-red-50'
                : cacOk
                  ? 'border-green-300 bg-green-50'
                  : ''
            }
          >
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              CAC платный
            </div>
            <div
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                cacHot ? 'text-red-700' : cacOk ? 'text-green-700' : 'text-gray-900'
              }`}
            >
              {efficiency.cac == null ? '—' : fmtKzt(efficiency.cac)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              расход / новые с utm_medium=paid ({efficiency.paidNew})
            </div>
            {cacHot ? (
              <p className="mt-2 text-sm font-medium text-red-700">
                Стоп кампаний — пересобрать креативы
              </p>
            ) : null}
          </Card>
          <MetricCard
            label="CR лендинга"
            value={fmtPct(efficiency.landingCr)}
            hint={`новые ${efficiency.newTotal} / визиты ${fmtNumber(efficiency.visits)}`}
          />
          <MetricCard
            label="Доля органики"
            value={fmtPct(efficiency.organicShare)}
            hint="utm_medium ≠ paid"
          />
          <MetricCard
            label="Офферы"
            value={fmtNumber(efficiency.redemptionsPeriod)}
            hint={`использований за ${periodDays}д`}
          />
        </div>
      </section>

      {/* Charts */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Графики · {periodDays} дней
        </h2>
        <AnalyticsCharts series={series} />
      </section>

      {/* Channels */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Каналы · {periodDays} дней
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">utm_source</th>
                <th className="px-4 py-3 font-medium">Подписчики</th>
                <th className="px-4 py-3 font-medium">Доля</th>
                <th className="px-4 py-3 font-medium">CAC</th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Нет новых подписчиков за период
                  </td>
                </tr>
              ) : (
                channels.map((ch) => (
                  <tr key={ch.utm_source} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {ch.utm_source}
                      {ch.isPaid ? (
                        <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-orange-700">
                          paid
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{ch.subscribers}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtPct(ch.share)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {ch.cac == null ? '—' : fmtKzt(ch.cac)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
