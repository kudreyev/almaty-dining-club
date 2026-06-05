export type RestaurantHour = {
  day_of_week: number
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  close_next_day?: boolean
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

export function normalizeTime(value: string | null): string | null {
  if (!value) return null
  const [hh, mm] = value.split(':')
  if (!hh || !mm) return null
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}

export function timeToMinutes(value: string | null): number | null {
  if (!value) return null
  const normalized = normalizeTime(value)
  if (!normalized) return null
  const [hh, mm] = normalized.split(':').map((part) => Number(part))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

export function nowMinutesInTimezone(date: Date, tz: string): number {
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
  if (!row.close_next_day && closeMinutes <= openMinutes) {
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

/**
 * Преобразует `OpenStatus.labelDetail` в короткую строку для карточки заведения.
 * Примеры:
 *  - «Работает до 23:00» → «до 23:00»
 *  - «Откроется в 09:00» → «откроется в 09:00»
 *  - «Откроется завтра в 09:00» → «откроется завтра в 09:00»
 *  - «Откроется в чт в 09:00» → «откроется в чт в 09:00»
 *  - null → null
 */
export function formatStatusForCard(status: OpenStatus): { label: 'Открыто' | 'Закрыто'; detail: string | null } {
  const label = status.isOpen ? 'Открыто' : 'Закрыто'
  if (!status.labelDetail) return { label, detail: null }

  if (status.isOpen) {
    const match = status.labelDetail.match(/Работает до\s+(.+)$/i)
    if (match) return { label, detail: `до ${match[1]}` }
  } else {
    const lowered = status.labelDetail.charAt(0).toLowerCase() + status.labelDetail.slice(1)
    return { label, detail: lowered }
  }

  return { label, detail: status.labelDetail }
}

export function computeOpenStatus(hoursForWeek: RestaurantHour[], now: Date, tz: string): OpenStatus {
  const todayDow = getTodayDow(now, tz)
  const yesterdayDow = ((todayDow + 5) % 7) + 1
  const nowMinutes = nowMinutesInTimezone(now, tz)

  // 1) Вчерашний spillover после полуночи: 18:00-02:00 + close_next_day=true.
  const yesterdayRow = findOpenRow(hoursForWeek, yesterdayDow)
  if (yesterdayRow?.close_next_day) {
    const yesterdayCloseMinutes = timeToMinutes(yesterdayRow.close_time)
    const yesterdayCloseTime = normalizeTime(yesterdayRow.close_time)
    if (
      yesterdayCloseMinutes != null &&
      yesterdayCloseTime &&
      nowMinutes < yesterdayCloseMinutes
    ) {
      return {
        isOpen: true,
        labelShort: 'Открыто',
        labelDetail: `Работает до ${yesterdayCloseTime}`,
      }
    }
  }

  // 2) Сегодняшний интервал.
  const todayRow = findOpenRow(hoursForWeek, todayDow)
  if (todayRow) {
    const openMinutes = timeToMinutes(todayRow.open_time)!
    const closeMinutes = timeToMinutes(todayRow.close_time)!
    const closeTime = normalizeTime(todayRow.close_time)
    const openTime = normalizeTime(todayRow.open_time)

    const isOpenToday = todayRow.close_next_day
      ? nowMinutes >= openMinutes
      : nowMinutes >= openMinutes && nowMinutes < closeMinutes

    if (isOpenToday) {
      return {
        isOpen: true,
        labelShort: 'Открыто',
        labelDetail: closeTime ? `Работает до ${closeTime}` : null,
      }
    }

    if (nowMinutes < openMinutes && openTime) {
      return {
        isOpen: false,
        labelShort: 'Закрыто',
        labelDetail: `Откроется в ${openTime}`,
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
