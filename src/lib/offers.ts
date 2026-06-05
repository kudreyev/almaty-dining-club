import {
  DEFAULT_TZ,
  WEEKDAY_LABELS_RU,
  getTodayDow,
  normalizeTime,
  nowMinutesInTimezone,
  timeToMinutes,
} from '@/lib/opening-hours'
import { ruDayWordAfterNumber } from '@/lib/ru-plural'

export const DEFAULT_OFFER_COOLDOWN_DAYS = 7

export type OfferType = '2for1' | 'compliment' | 'kudafest_set'

export type CatalogOfferLike = {
  is_active: boolean
  end_date?: string | null
}

export type OfferUsableHour = {
  day_of_week: number
  is_unavailable: boolean
  from_time: string | null
  to_time: string | null
  to_next_day?: boolean
}

export function getOfferUsableHours(
  source: { offer_usable_hours?: OfferUsableHour[] | null },
): OfferUsableHour[] {
  return source.offer_usable_hours ?? []
}

export function hasOfferUsableSchedule(hours: OfferUsableHour[]): boolean {
  return hours.some(
    (row) => !row.is_unavailable && Boolean(row.from_time) && Boolean(row.to_time),
  )
}

function findUsableHourRow(
  hours: OfferUsableHour[],
  dayOfWeek: number,
): OfferUsableHour | null {
  const row = hours.find((item) => item.day_of_week === dayOfWeek)
  if (!row || row.is_unavailable || !row.from_time || !row.to_time) return null
  return row
}

function isWithinHourRow(row: OfferUsableHour, nowMinutes: number): boolean {
  const fromMinutes = timeToMinutes(row.from_time)
  const toMinutes = timeToMinutes(row.to_time)
  if (fromMinutes == null || toMinutes == null) return false

  if (row.to_next_day) {
    return nowMinutes >= fromMinutes
  }

  return nowMinutes >= fromMinutes && nowMinutes < toMinutes
}

/** Оффер с расписанием доступен в текущий момент (таймзона каталога). */
export function isOfferUsableNow(
  hours: OfferUsableHour[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): boolean {
  if (!hasOfferUsableSchedule(hours)) return true

  const todayDow = getTodayDow(now, tz)
  const yesterdayDow = ((todayDow + 5) % 7) + 1
  const nowMinutes = nowMinutesInTimezone(now, tz)

  const yesterdayRow = findUsableHourRow(hours, yesterdayDow)
  if (yesterdayRow?.to_next_day) {
    const toMinutes = timeToMinutes(yesterdayRow.to_time)
    if (toMinutes != null && nowMinutes < toMinutes) {
      return true
    }
  }

  const todayRow = findUsableHourRow(hours, todayDow)
  if (!todayRow) return false

  return isWithinHourRow(todayRow, nowMinutes)
}

function findNextUsableDay(
  hours: OfferUsableHour[],
  todayDow: number,
): { day: number; from: string; to: string } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDow = ((todayDow - 1 + offset) % 7) + 1
    const row = findUsableHourRow(hours, nextDow)
    if (!row?.from_time || !row.to_time) continue
    const from = normalizeTime(row.from_time)
    const to = normalizeTime(row.to_time)
    if (!from || !to) continue
    return { day: nextDow, from, to }
  }
  return null
}

/** «Сегодня с 12:00 до 15:00» */
export function formatOfferUsableDayLabel(fromTime: string, toTime: string): string {
  const from = normalizeTime(fromTime) ?? fromTime
  const to = normalizeTime(toTime) ?? toTime
  return `Сегодня с ${from} до ${to}`
}

export function formatOfferUsableHoursStatus(
  hours: OfferUsableHour[],
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): { isUsable: boolean; label: string | null } {
  if (!hasOfferUsableSchedule(hours)) {
    return { isUsable: true, label: null }
  }

  const todayDow = getTodayDow(now, tz)
  const todayRow = findUsableHourRow(hours, todayDow)

  if (!todayRow?.from_time || !todayRow.to_time) {
    const next = findNextUsableDay(hours, todayDow)
    if (next) {
      const dayLabel = WEEKDAY_LABELS_RU[next.day].toLowerCase()
      return {
        isUsable: false,
        label: `Доступно в ${dayLabel} с ${next.from} до ${next.to}`,
      }
    }
    return { isUsable: false, label: 'Сегодня недоступен' }
  }

  const label = formatOfferUsableDayLabel(todayRow.from_time, todayRow.to_time)
  return { isUsable: isOfferUsableNow(hours, now, tz), label }
}

/** Краткое расписание для админки: «пн 12:00–15:00, сб 18:00–21:00». */
export function formatOfferUsableScheduleSummary(hours: OfferUsableHour[]): string | null {
  const active = hours
    .filter((row) => !row.is_unavailable && row.from_time && row.to_time)
    .sort((a, b) => a.day_of_week - b.day_of_week)

  if (active.length === 0) return null

  return active
    .map((row) => {
      const day = WEEKDAY_LABELS_RU[row.day_of_week].toLowerCase()
      const from = normalizeTime(row.from_time) ?? row.from_time
      const to = normalizeTime(row.to_time) ?? row.to_time
      return `${day} ${from}–${to}`
    })
    .join(', ')
}

/** Сегодняшняя дата YYYY-MM-DD в заданной таймзоне (как для часов работы каталога). */
export function getTodayDateStringInTz(
  date: Date = new Date(),
  tz: string = DEFAULT_TZ,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isOfferCatalogActive(
  offer: CatalogOfferLike,
  todayString: string,
): boolean {
  if (!offer.is_active) return false
  if (!offer.end_date) return true
  return offer.end_date >= todayString
}

export function filterCatalogActiveOffers<T extends CatalogOfferLike>(
  offers: T[],
  todayString: string,
): T[] {
  return offers.filter((offer) => isOfferCatalogActive(offer, todayString))
}

export function hasCatalogActiveOffers<T extends CatalogOfferLike>(
  offers: T[],
  todayString: string,
): boolean {
  return offers.some((offer) => isOfferCatalogActive(offer, todayString))
}

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** «Kudafest · до 8 июня» */
export function formatKudafestBadgeDate(endDate: string): string {
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(parseDateOnly(endDate))
  return `Kudafest · до ${formatted}`
}

export function formatOfferHeadline(offerType: OfferType, offerTitle: string): string {
  if (offerType === '2for1') return `2за1 · ${offerTitle}`
  if (offerType === 'kudafest_set') return `Сеты Kudafest · ${offerTitle}`
  return `${offerTitle} в подарок`
}

/** Развёрнутый заголовок оффера с пробелами: «2 за 1 · {название}» / «{название} в подарок». */
export function formatOfferTitle(offerType: OfferType, offerTitle: string): string {
  if (offerType === '2for1') return `2 за 1 · ${offerTitle}`
  if (offerType === 'kudafest_set') return `Сеты Kudafest · ${offerTitle}`
  return `${offerTitle} в подарок`
}

/** Лейбл плашки оффера на карточке заведения. */
export function formatOfferChipLabel(offerType: OfferType, offerTitle: string): string {
  if (offerType === '2for1') return `2 за 1 · ${offerTitle}`
  if (offerType === 'kudafest_set') return `Сеты Kudafest · ${offerTitle}`
  return `${offerTitle} в подарок`
}

type OfferLike = {
  offer_type: OfferType
  is_active: boolean
  estimated_value?: number | null
}

/** Сначала 2-за-1, потом подарки, затем Kudafest; ограничено maxN. Возвращает только активные. */
export function pickTopOffers<T extends OfferLike>(offers: T[], maxN = 3): T[] {
  const active = offers.filter((offer) => offer.is_active)
  const twoFor1 = active.filter((offer) => offer.offer_type === '2for1')
  const compliments = active.filter((offer) => offer.offer_type === 'compliment')
  const kudafest = active.filter((offer) => offer.offer_type === 'kudafest_set')
  return [...twoFor1, ...compliments, ...kudafest].slice(0, maxN)
}

/** Максимальная выгода (estimated_value) среди активных офферов; null — если нет данных. */
export function getMaxBenefit<T extends OfferLike>(offers: T[]): number | null {
  let max: number | null = null
  for (const offer of offers) {
    if (!offer.is_active) continue
    const value = offer.estimated_value
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    if (max === null || value > max) max = value
  }
  return max
}

/** Лейбл плашки выгоды: «Выгода ~5 000 ₸» при 1 оффере, «Выгода до ~5 000 ₸» при 2+. */
export function formatBenefitLabel<T extends OfferLike>(offers: T[]): string | null {
  const active = offers.filter((offer) => offer.is_active)
  const max = getMaxBenefit(active)
  if (max === null) return null

  const formatted = new Intl.NumberFormat('ru-RU').format(Math.round(max))
  return active.length >= 2 ? `Выгода до ~${formatted} ₸` : `Выгода ~${formatted} ₸`
}

export function formatEstimatedValue(estimatedValue?: number | null): string | null {
  if (typeof estimatedValue !== 'number' || Number.isNaN(estimatedValue)) {
    return null
  }

  const formatted = new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(estimatedValue)))
  return `Выгода ~${formatted} ₸`
}

export function resolveOfferCooldownDays(
  cooldownDays?: number | null,
  fallbackDays = DEFAULT_OFFER_COOLDOWN_DAYS,
): number {
  if (typeof cooldownDays !== 'number' || Number.isNaN(cooldownDays) || cooldownDays < 1) {
    return fallbackDays
  }

  return Math.round(cooldownDays)
}

/** Текст доступности оффера для UI (чип «Доступно …»). */
export function formatOfferCooldownText(cooldownDays?: number | null): string {
  const days = resolveOfferCooldownDays(cooldownDays)
  if (days === 1) {
    return 'Доступно каждый день'
  }
  return `Доступно раз в ${days} ${ruDayWordAfterNumber(days)}`
}
