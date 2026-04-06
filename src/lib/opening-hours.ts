export type RestaurantHour = {
  day_of_week: number
  is_closed: boolean
  open_time: string | null
  close_time: string | null
}

export type OpenStatus = {
  isOpen: boolean
  labelShort: string
  labelDetail: string | null
}

export const DEFAULT_TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Almaty'

export const WEEKDAY_LABELS_RU: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
}

const WEEKDAY_LABELS_RU_LOWER: Record<number, string> = {
  1: 'пн',
  2: 'вт',
  3: 'ср',
  4: 'чт',
  5: 'пт',
  6: 'сб',
  7: 'вс',
}

const WEEKDAY_TO_DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

function normalizeTime(value: string | null): string | null {
  if (!value) return null
  const [hh, mm] = value.split(':')
  if (!hh || !mm) return null
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}

function timeToMinutes(value: string | null): number | null {
  if (!value) return null
  const normalized = normalizeTime(value)
  if (!normalized) return null
  const [hh, mm] = normalized.split(':').map((part) => Number(part))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

function nowMinutesInTimezone(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

function findOpenRow(hoursForWeek: RestaurantHour[], dayOfWeek: number): RestaurantHour | null {
  const row = hoursForWeek.find((item) => item.day_of_week === dayOfWeek)
  if (!row || row.is_closed || !row.open_time || !row.close_time) return null
  const openMinutes = timeToMinutes(row.open_time)
  const closeMinutes = timeToMinutes(row.close_time)
  if (openMinutes == null || closeMinutes == null) return null
  if (closeMinutes <= openMinutes) {
    // TODO: ночные интервалы (пример 18:00-02:00) пока не поддерживаем на MVP.
    return null
  }
  return row
}

export function getTodayDow(date: Date, tz: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(date)

  return WEEKDAY_TO_DOW[weekday] ?? 1
}

export function formatHoursRange(hour: RestaurantHour | null | undefined): string {
  if (!hour || hour.is_closed || !hour.open_time || !hour.close_time) {
    return 'выходной'
  }

  const open = normalizeTime(hour.open_time)
  const close = normalizeTime(hour.close_time)
  if (!open || !close) return 'выходной'
  return `${open}-${close}`
}

export function computeOpenStatus(hoursForWeek: RestaurantHour[], now: Date, tz: string): OpenStatus {
  const todayDow = getTodayDow(now, tz)
  const nowMinutes = nowMinutesInTimezone(now, tz)

  const todayOpenRow = findOpenRow(hoursForWeek, todayDow)
  if (todayOpenRow) {
    const openMinutes = timeToMinutes(todayOpenRow.open_time)!
    const closeMinutes = timeToMinutes(todayOpenRow.close_time)!
    const closeTime = normalizeTime(todayOpenRow.close_time)
    const openTime = normalizeTime(todayOpenRow.open_time)

    if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
      return {
        isOpen: true,
        labelShort: 'Открыто',
        labelDetail: closeTime ? `Работает до ${closeTime}` : null,
      }
    }

    if (nowMinutes < openMinutes) {
      return {
        isOpen: false,
        labelShort: 'Закрыто',
        labelDetail: openTime ? `Откроется в ${openTime}` : null,
      }
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDow = ((todayDow - 1 + offset) % 7) + 1
    const nextOpenRow = findOpenRow(hoursForWeek, nextDow)
    if (!nextOpenRow) continue

    const nextOpenTime = normalizeTime(nextOpenRow.open_time)
    if (!nextOpenTime) break

    if (offset === 1) {
      return {
        isOpen: false,
        labelShort: 'Закрыто',
        labelDetail: `Откроется завтра в ${nextOpenTime}`,
      }
    }

    return {
      isOpen: false,
      labelShort: 'Закрыто',
      labelDetail: `Откроется в ${WEEKDAY_LABELS_RU_LOWER[nextDow]} в ${nextOpenTime}`,
    }
  }

  return {
    isOpen: false,
    labelShort: 'Закрыто',
    labelDetail: null,
  }
}
