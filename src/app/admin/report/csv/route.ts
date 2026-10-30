import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  lastCompleteWeekStart,
  snapToMonday,
  weeklyReportToCsv,
  type WeeklyReport,
} from '@/lib/weekly-report'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  await requireAdmin('/admin/report')
  const url = new URL(req.url)
  const weekStart = url.searchParams.get('week')
    ? snapToMonday(String(url.searchParams.get('week')))
    : lastCompleteWeekStart()

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc('get_weekly_report', { week_start: weekStart })
  if (error || !data) {
    return NextResponse.json({ error: 'report_unavailable' }, { status: 500 })
  }

  const report = data as WeeklyReport
  const csv = weeklyReportToCsv(report.venues_week ?? [])
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kudaclub-venues-${weekStart}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
