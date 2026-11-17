import {
  DEFAULT_TZ,
  WEEKDAY_LABELS_RU,
  getTodayDow,
  normalizeTime,
  nowMinutesInTimezone,
  timeToMinutes,
} from '@/lib/opening-hours'
import { getTodayDateStringInTz } from '@/lib/offers'
import type { City } from '@/lib/cities'

export type FestivalEvent = {
  id: string
  slug: string
  name: string
  city: City
  starts_at: string
  ends_at: string
  set_price_kzt: number
  logo_url?: string | null
  accent_color: string
  is_published: boolean
  max_sets_per_venue_per_day?: number
}

export type EventVenueScheduleRow = {
  weekday: number
  open_time: string
  close_time: string
  offer_id?: string | null
}

export type SetItem = {
  title: string
  options?: string[]
}

/** Фестиваль активен сегодня (Asia/Almaty) и опубликован. */
export function isEventActiveNow(
  event: Pick<FestivalEvent, 'starts_at' | 'ends_at' | 'is_published'>,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): boolean {
  if (!event.is_published) return false
  const today = getTodayDateStringInTz(now, tz)
  return today >= event.starts_at && today <= event.ends_at
}

export function formatEventEndsLabel(endsAt: string): string {
  const [year, month, day] = endsAt.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day))
}

export function formatSetPrice(priceKzt: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(priceKzt))} ₸`
}

/** close_time 00:00 = конец дня (24:00). */
function closeMinutes(closeTime: string | null | undefined): number | null {
  const normalized = normalizeTime(closeTime)
  if (!normalized) return null
  if (normalized === '00:00') return 24 * 60
  return timeToMinutes(normalized)
}

function isWithinScheduleWindow(
  openTime: string,
  closeTime: string,
  nowMinutes: number,
): boolean {
  const open = timeToMinutes(normalizeTime(openTime) ?? openTime)
  const close = closeMinutes(closeTime)
  if (open == null || close == null) return false

  if (close > open) {
    return nowMinutes >= open && nowMinutes < close
  }
  // Overnight: open → midnight → close next day
  return nowMinutes >= open || nowMinutes < close
}

/** Resolve schedule rows for an offer: prefer offer-specific, else venue-level. */
export function resolveSetSchedule(
  rows: EventVenueScheduleRow[],
  offerId?: string | null,
): EventVenueScheduleRow[] {
  if (!rows.length) return []
  if (offerId) {
    const specific = rows.filter((r) => r.offer_id === offerId)
    if (specific.length > 0) return specific
  }
  return rows.filter((r) => !r.offer_id)
}

export function isSetServingNow(
  schedule: EventVenueScheduleRow[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): boolean {
  if (schedule.length === 0) return false

  const todayDow = getTodayDow(now, tz)
  const yesterdayDow = ((todayDow + 5) % 7) + 1
  const nowMinutes = nowMinutesInTimezone(now, tz)

  for (const row of schedule) {
    if (row.weekday === todayDow && isWithinScheduleWindow(row.open_time, row.close_time, nowMinutes)) {
      return true
    }
    // Overnight from yesterday
    const close = closeMinutes(row.close_time)
    const open = timeToMinutes(normalizeTime(row.open_time) ?? row.open_time)
    if (
      row.weekday === yesterdayDow
      && close != null
      && open != null
      && close <= open
      && close !== 24 * 60
      && nowMinutes < close
    ) {
      return true
    }
  }
  return false
}

export type SetServingStatus = {
  isServing: boolean
  /** Short status for catalog badge: «подают до 12:00» / «сегодня с 09:00» / «сегодня не подают» */
  badgeLabel: string
  /** CTA disabled hint: «Сет подают с 08:00» / «Сегодня не подают» */
  ctaLabel: string
  /** Minutes until next open today, or large number if later day / none */
  nextOpenSortKey: number
}

function formatClock(time: string): string {
  return normalizeTime(time) ?? time.slice(0, 5)
}

export function getSetServingStatus(
  schedule: EventVenueScheduleRow[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): SetServingStatus {
  const todayDow = getTodayDow(now, tz)
  const nowMinutes = nowMinutesInTimezone(now, tz)
  const todayWindows = schedule
    .filter((r) => r.weekday === todayDow)
    .sort((a, b) => (timeToMinutes(a.open_time) ?? 0) - (timeToMinutes(b.open_time) ?? 0))

  if (isSetServingNow(schedule, now, tz)) {
    const active = todayWindows.find((row) =>
      isWithinScheduleWindow(row.open_time, row.close_time, nowMinutes),
    )
    const until = active ? formatClock(active.close_time === '00:00' ? '00:00' : active.close_time) : null
    const untilLabel =
      until && until !== '00:00'
        ? `подают до ${until}`
        : until === '00:00'
          ? 'подают до конца дня'
          : 'подают сейчас'
    return {
      isServing: true,
      badgeLabel: untilLabel,
      ctaLabel: '',
      nextOpenSortKey: 0,
    }
  }

  if (todayWindows.length === 0) {
    const next = findNextOpen(schedule, todayDow)
    return {
      isServing: false,
      badgeLabel: 'сегодня не подают',
      ctaLabel: 'Сегодня не подают',
      nextOpenSortKey: next ? next.sortKey : 10_000,
    }
  }

  const upcoming = todayWindows.find((row) => {
    const open = timeToMinutes(normalizeTime(row.open_time) ?? row.open_time)
    return open != null && nowMinutes < open
  })

  if (upcoming) {
    const from = formatClock(upcoming.open_time)
    const openMin = timeToMinutes(normalizeTime(upcoming.open_time) ?? upcoming.open_time) ?? 0
    return {
      isServing: false,
      badgeLabel: `сегодня с ${from}`,
      ctaLabel: `Сет подают с ${from}`,
      nextOpenSortKey: Math.max(0, openMin - nowMinutes),
    }
  }

  return {
    isServing: false,
    badgeLabel: 'сегодня не подают',
    ctaLabel: 'Сегодня не подают',
    nextOpenSortKey: findNextOpen(schedule, todayDow)?.sortKey ?? 10_000,
  }
}

function findNextOpen(
  schedule: EventVenueScheduleRow[],
  todayDow: number,
): { sortKey: number } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const dow = ((todayDow - 1 + offset) % 7) + 1
    const rows = schedule
      .filter((r) => r.weekday === dow)
      .sort((a, b) => (timeToMinutes(a.open_time) ?? 0) - (timeToMinutes(b.open_time) ?? 0))
    if (rows[0]) {
      return { sortKey: offset * 24 * 60 + (timeToMinutes(rows[0].open_time) ?? 0) }
    }
  }
  return null
}

type ScheduleGroup = { days: number[]; open: string; close: string }

/** «Пн–Пт 08:00–12:00 · Сб–Вс 09:00–14:00» */
export function formatCompactSchedule(schedule: EventVenueScheduleRow[]): string {
  if (schedule.length === 0) return ''

  const byKey = new Map<string, number[]>()
  for (const row of schedule) {
    const open = formatClock(row.open_time)
    const close = row.close_time === '00:00' || normalizeTime(row.close_time) === '00:00'
      ? '00:00'
      : formatClock(row.close_time)
    const key = `${open}|${close}`
    const days = byKey.get(key) ?? []
    if (!days.includes(row.weekday)) days.push(row.weekday)
    byKey.set(key, days)
  }

  const groups: ScheduleGroup[] = [...byKey.entries()]
    .map(([key, days]) => {
      const [open, close] = key.split('|')
      return { days: days.sort((a, b) => a - b), open, close }
    })
    .sort((a, b) => (a.days[0] ?? 0) - (b.days[0] ?? 0))

  return groups
    .map((g) => `${formatDayRanges(g.days)} ${g.open}–${g.close === '00:00' ? '24:00' : g.close}`)
    .join(' · ')
}

function formatDayRanges(days: number[]): string {
  if (days.length === 0) return ''
  const ranges: Array<[number, number]> = []
  let start = days[0]
  let prev = days[0]
  for (let i = 1; i < days.length; i += 1) {
    if (days[i] === prev + 1) {
      prev = days[i]
      continue
    }
    ranges.push([start, prev])
    start = days[i]
    prev = days[i]
  }
  ranges.push([start, prev])

  return ranges
    .map(([from, to]) =>
      from === to
        ? WEEKDAY_LABELS_RU[from]
        : `${WEEKDAY_LABELS_RU[from]}–${WEEKDAY_LABELS_RU[to]}`,
    )
    .join(', ')
}

export function isClubOfferType(offerType: string): boolean {
  return offerType === '2for1' || offerType === 'compliment'
}

export function parseSetItems(items: unknown): SetItem[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as { title?: unknown; options?: unknown }
      if (typeof row.title !== 'string' || !row.title.trim()) return null
      const options = Array.isArray(row.options)
        ? row.options.filter((o): o is string => typeof o === 'string' && Boolean(o.trim()))
        : undefined
      return { title: row.title.trim(), options: options?.length ? options : undefined }
    })
    .filter((x): x is SetItem => Boolean(x))
}
