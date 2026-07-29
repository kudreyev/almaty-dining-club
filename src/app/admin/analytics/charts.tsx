'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { AnalyticsSeries } from '@/lib/admin-analytics'

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

export function AnalyticsCharts({ series }: { series: AnalyticsSeries }) {
  const activeData = series.dates.map((date, i) => ({
    date: shortDate(date),
    active: series.activeByDay[i] ?? 0,
  }))

  const newCancelData = series.dates.map((date, i) => ({
    date: shortDate(date),
    new: series.newByDay[i] ?? 0,
    cancelled: series.cancelledByDay[i] ?? 0,
  }))

  const spendNewData = series.dates.map((date, i) => ({
    date: shortDate(date),
    spend: series.spendByDay[i] ?? 0,
    new: series.newByDayAll[i] ?? 0,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-1">
      <ChartCard title="Активные подписчики">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={activeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="active"
              name="Активные"
              stroke="#D85A30"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Новые vs отмены">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={newCancelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="new" name="Новые" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="cancelled"
              name="Отмены"
              fill="#dc2626"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Расход vs новые подписчики">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={spendNewData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              label={{ value: 'Новые', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={{ value: 'Расход ₸', angle: 90, position: 'insideRight', fontSize: 11 }}
            />
            <Tooltip />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="new"
              name="Новые"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="spend"
              name="Расход"
              stroke="#D85A30"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  )
}
