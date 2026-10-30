export type WeeklyReportVenue = {
  name: string
  city?: string
  is_active?: boolean
  redemptions: number
  guests: number
  new_guests: number
  returning_guests: number
  savings?: number
}

export type WeeklyReportOffer = {
  venue: string
  offer: string
  redemptions: number
}

export type WeeklyReportGoal = {
  metric: string
  current: number | null
  target: number
  pct: number | null
}

export type WeeklyReport = {
  week: { start: string; end: string; label: string }
  users: {
    registered_total: number
    registered_total_prev: number
    new: number
    new_prev: number
  }
  activity: {
    weekly_active: number
    weekly_active_prev: number
    redemptions: number
    redemptions_prev: number
    redemptions_30d: number
    redemptions_30d_prev: number
  }
  retention_m2_pct: number | null
  retention_m2_pct_prev: number | null
  savings: { week: number; week_prev: number; lifetime: number }
  venues: {
    active: number
    with_redemptions: number
    with_redemptions_prev: number
    zero_count: number
    zero_names: string[]
  }
  top_venues: WeeklyReportVenue[]
  top_offers: WeeklyReportOffer[]
  venues_week: WeeklyReportVenue[]
  by_weekday: { dow: number; label: string; count: number }[]
  by_hour: { hour: number; count: number }[]
  peak: { weekday: string; hour_start: number; hour_end: number; label: string } | null
  channels: {
    by_utm_source: { source: string; count: number }[]
    by_ref_code: { code: string; count: number }[]
    combined: { channel: string; count: number }[]
  }
  goals: { target_date: string; items: WeeklyReportGoal[] }
}

const GOAL_LABELS: Record<string, string> = {
  registered: 'пользователи',
  weekly_active: 'активные',
  redemptions_30d: 'погашения 30 дн.',
  retention_m2_pct: 'удержание',
  active_venues: 'заведения',
}

export function formatInt(n: number): string {
  const abs = Math.abs(Math.round(n))
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return n < 0 ? `-${grouped}` : grouped
}

export function formatSigned(n: number): string {
  const rounded = Math.round(n)
  if (rounded > 0) return `+${formatInt(rounded)}`
  if (rounded < 0) return formatInt(rounded)
  return '0'
}

export function formatKzt(n: number): string {
  const value = Math.round(Number(n) || 0)
  if (Math.abs(value) >= 1_000_000) {
    const mln = value / 1_000_000
    const text =
      Math.abs(mln - Math.round(mln)) < 0.05
        ? `${Math.round(mln)}`
        : mln.toFixed(1).replace('.', ',')
    return `${text} млн ₸`
  }
  return `${formatInt(value)} ₸`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatGoalDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatWeeklyReportTelegram(report: WeeklyReport): string {
  const users = report.users
  const activity = report.activity
  const savings = report.savings
  const venues = report.venues
  const peak = report.peak
  const goals = report.goals

  const lines: string[] = [
    `<b>KudaClub: неделя ${escapeHtml(report.week.label)}</b>`,
    `Пользователи: ${formatInt(users.registered_total)} (${formatSigned(users.new)} за неделю, было ${formatSigned(users.new_prev)})`,
    `Активных за неделю: ${formatInt(activity.weekly_active)} (${formatSigned(activity.weekly_active - activity.weekly_active_prev)})`,
    `Погашений: ${formatInt(activity.redemptions)} (${formatSigned(activity.redemptions - activity.redemptions_prev)}) · за 30 дней: ${formatInt(activity.redemptions_30d)}`,
    `Удержание во 2-м месяце: ${report.retention_m2_pct == null ? 'н/д' : `${formatInt(Math.round(Number(report.retention_m2_pct)))}%`}`,
    `Выгода гостей: ${formatKzt(savings.week)} · всего ${formatKzt(savings.lifetime)}`,
  ]

  if (goals?.items?.length) {
    const parts = goals.items
      .map((item) => {
        const label = GOAL_LABELS[item.metric] ?? item.metric
        const pct = item.pct == null ? 'н/д' : `${formatInt(Math.round(Number(item.pct)))}%`
        return `${label} ${pct}`
      })
      .join(' · ')
    lines.push(`Цели к ${formatGoalDate(String(goals.target_date))}: ${parts}`)
  }

  const top = (report.top_venues ?? []).slice(0, 5).map((venue) => {
    const name = escapeHtml(venue.name)
    if (venue.new_guests > 0) {
      return `${name} ${formatInt(venue.redemptions)} (${formatInt(venue.new_guests)} новых)`
    }
    return `${name} ${formatInt(venue.redemptions)}`
  })
  lines.push(`Топ заведений: ${top.length ? top.join(' · ') : 'нет'}`)

  const zeroNames = (venues.zero_names ?? []).slice(0, 5).map(escapeHtml)
  const extra = (venues.zero_names ?? []).length > 5 ? ', ...' : ''
  if (venues.zero_count > 0) {
    lines.push(
      `Без погашений: ${formatInt(venues.zero_count)} заведений (${zeroNames.join(', ')}${extra})`,
    )
  } else {
    lines.push('Без погашений: нет')
  }

  const channels = (report.channels?.combined ?? []).map(
    (row) => `${escapeHtml(row.channel)} ${formatInt(row.count)}`,
  )
  lines.push(`Каналы: ${channels.length ? channels.join(' · ') : 'нет'}`)
  lines.push(`Пик: ${peak?.label ? escapeHtml(peak.label) : 'нет данных'}`)

  return lines.join('\n')
}

export function weeklyReportToCsv(venues: WeeklyReportVenue[]): string {
  const header = [
    'заведение',
    'город',
    'активно',
    'погашений',
    'гости',
    'новые',
    'вернувшиеся',
    'выгода',
  ]
  const rows = venues.map((venue) =>
    [
      csvCell(venue.name),
      csvCell(venue.city ?? ''),
      venue.is_active === false ? 'нет' : 'да',
      String(num(venue.redemptions)),
      String(num(venue.guests)),
      String(num(venue.new_guests)),
      String(num(venue.returning_guests)),
      String(num(venue.savings)),
    ].join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function lastCompleteWeekStart(now = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const thisMonday = snapToMonday(ymd)
  const [year, month, day] = thisMonday.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 7)
  return date.toISOString().slice(0, 10)
}

export function snapToMonday(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return lastCompleteWeekStart()
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const dow = date.getUTCDay()
  const delta = dow === 0 ? -6 : 1 - dow
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

export function recentMondays(count = 16, now = new Date()): string[] {
  const start = lastCompleteWeekStart(now)
  const [year, month, day] = start.split('-').map(Number)
  const cursor = new Date(Date.UTC(year, month - 1, day))
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(cursor)
    d.setUTCDate(cursor.getUTCDate() - index * 7)
    return d.toISOString().slice(0, 10)
  })
}
