import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/card'
import {
  formatInt,
  formatKzt,
  formatSigned,
  lastCompleteWeekStart,
  recentMondays,
  snapToMonday,
  type WeeklyReport,
} from '@/lib/weekly-report'
import { WeekPicker } from './week-picker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Отчёт — Kudaclub Admin',
  robots: { index: false, follow: false },
}

const GOAL_LABELS: Record<string, string> = {
  registered: 'Пользователи',
  weekly_active: 'Активные за неделю',
  redemptions_30d: 'Погашения за 30 дней',
  retention_m2_pct: 'Удержание во 2-м месяце',
  active_venues: 'Активные заведения',
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
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </Card>
  )
}

export default async function AdminReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  await requireAdmin('/admin/report')
  const sp = await searchParams
  const weekStart = sp.week ? snapToMonday(sp.week) : lastCompleteWeekStart()
  const weeks = recentMondays(16)

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc('get_weekly_report', { week_start: weekStart })
  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Еженедельный отчёт</h1>
        <p className="mt-4 text-sm text-red-600">
          Не удалось загрузить отчёт. Примените миграцию weekly_report в Supabase.
        </p>
      </div>
    )
  }

  const report = data as WeeklyReport
  const users = report.users
  const activity = report.activity

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Еженедельный отчёт
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Неделя {report.week.label} по Алматы. Только погашения, подтверждённые на /staff.
            Без тестовых аккаунтов.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WeekPicker weeks={weeks} current={weekStart} />
          <a
            href={`/admin/report/csv?week=${weekStart}`}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Скачать CSV
          </a>
        </div>
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Пользователи"
          value={formatInt(users.registered_total)}
          hint={`${formatSigned(users.new)} за неделю, было ${formatSigned(users.new_prev)}`}
        />
        <MetricCard
          label="Активных за неделю"
          value={formatInt(activity.weekly_active)}
          hint={formatSigned(activity.weekly_active - activity.weekly_active_prev)}
        />
        <MetricCard
          label="Погашений"
          value={formatInt(activity.redemptions)}
          hint={`${formatSigned(activity.redemptions - activity.redemptions_prev)} · за 30 дней ${formatInt(activity.redemptions_30d)}`}
        />
        <MetricCard
          label="Удержание во 2-м месяце"
          value={report.retention_m2_pct == null ? 'н/д' : `${Math.round(Number(report.retention_m2_pct))}%`}
        />
        <MetricCard label="Выгода за неделю" value={formatKzt(report.savings.week)} />
        <MetricCard label="Выгода всего" value={formatKzt(report.savings.lifetime)} />
        <MetricCard
          label="Заведения с погашениями"
          value={`${formatInt(report.venues.with_redemptions)} / ${formatInt(report.venues.active)}`}
        />
        <MetricCard
          label="Без погашений"
          value={formatInt(report.venues.zero_count)}
          hint={(report.venues.zero_names ?? []).slice(0, 4).join(', ') || undefined}
        />
      </section>

      {report.goals?.items?.length ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Цели к {String(report.goals.target_date).slice(0, 10)}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {report.goals.items.map((item) => (
              <MetricCard
                key={item.metric}
                label={GOAL_LABELS[item.metric] ?? item.metric}
                value={item.pct == null ? 'н/д' : `${Math.round(Number(item.pct))}%`}
                hint={`${item.current == null ? '—' : formatInt(Number(item.current))} из ${formatInt(Number(item.target))}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Когда пользуются
        </h2>
        <Card>
          <p className="text-sm text-gray-700">
            Пик: {report.peak?.label ?? 'нет данных'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {(report.by_weekday ?? []).map((row) => (
              <span key={row.dow} className="rounded-md bg-neutral-50 px-2 py-1 tabular-nums">
                {row.label} {formatInt(row.count)}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-6 gap-1 text-[11px] text-gray-600 sm:grid-cols-12">
            {(report.by_hour ?? []).map((row) => (
              <span key={row.hour} className="tabular-nums">
                {String(row.hour).padStart(2, '0')}: {row.count}
              </span>
            ))}
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Каналы регистрации
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              utm_source
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(report.channels?.by_utm_source ?? []).map((row) => (
                <li key={row.source} className="flex justify-between gap-4">
                  <span>{row.source}</span>
                  <span className="tabular-nums">{formatInt(row.count)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Реферальный код
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(report.channels?.by_ref_code ?? []).length === 0 ? (
                <li className="text-gray-500">Нет</li>
              ) : (
                (report.channels?.by_ref_code ?? []).map((row) => (
                  <li key={row.code} className="flex justify-between gap-4">
                    <span>{row.code}</span>
                    <span className="tabular-nums">{formatInt(row.count)}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Заведения за неделю
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Заведение</th>
                <th className="px-4 py-2 font-medium">Город</th>
                <th className="px-4 py-2 font-medium">Погашений</th>
                <th className="px-4 py-2 font-medium">Гости</th>
                <th className="px-4 py-2 font-medium">Новые</th>
                <th className="px-4 py-2 font-medium">Вернувшиеся</th>
                <th className="px-4 py-2 font-medium">Выгода</th>
              </tr>
            </thead>
            <tbody>
              {(report.venues_week ?? []).map((venue) => (
                <tr key={`${venue.name}-${venue.city}`} className="border-t border-gray-100">
                  <td className="px-4 py-2">{venue.name}</td>
                  <td className="px-4 py-2 text-gray-500">{venue.city}</td>
                  <td className="px-4 py-2 tabular-nums">{formatInt(venue.redemptions)}</td>
                  <td className="px-4 py-2 tabular-nums">{formatInt(venue.guests)}</td>
                  <td className="px-4 py-2 tabular-nums">{formatInt(venue.new_guests)}</td>
                  <td className="px-4 py-2 tabular-nums">{formatInt(venue.returning_guests)}</td>
                  <td className="px-4 py-2 tabular-nums">{formatKzt(Number(venue.savings ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Офферы
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Заведение</th>
                <th className="px-4 py-2 font-medium">Оффер</th>
                <th className="px-4 py-2 font-medium">Погашений</th>
              </tr>
            </thead>
            <tbody>
              {(report.top_offers ?? []).length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-gray-500" colSpan={3}>
                    Нет погашений за неделю
                  </td>
                </tr>
              ) : (
                (report.top_offers ?? []).map((offer) => (
                  <tr key={`${offer.venue}-${offer.offer}`} className="border-t border-gray-100">
                    <td className="px-4 py-2">{offer.venue}</td>
                    <td className="px-4 py-2">{offer.offer}</td>
                    <td className="px-4 py-2 tabular-nums">{formatInt(offer.redemptions)}</td>
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
