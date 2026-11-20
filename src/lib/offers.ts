import {
  DEFAULT_TZ,
  WEEKDAY_LABELS_RU,
  getTodayDow,
  normalizeTime,
  nowMinutesInTimezone,
  timeToMinutes,
} from '@/lib/opening-hours'
export type OfferType = '2for1' | 'compliment' | 'set'

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

/**
 * Заголовок сета: «KudaFest сет» или «KudaFest сет №1», если сетов в заведении больше одного.
 * Номер берётся из offer_title («Сет №1») или из index (0-based).
 */
export function formatSetOfferTitle(
  eventName?: string | null,
  options?: {
    showNumber?: boolean
    offerTitle?: string | null
    index?: number
  },
): string {
  const name = (eventName?.trim() || 'KudaFest')
  if (!options?.showNumber) return `${name} сет`

  const fromTitle = options.offerTitle?.match(/№\s*(\d+)/i)?.[1]
  const num =
    fromTitle ?? (options.index != null ? String(options.index + 1) : null)
  return num ? `${name} сет №${num}` : `${name} сет`
}

/** Сет фестиваля в данных: тип set или привязка к event. */
export function isFestivalSetOffer(offer: {
  offer_type?: string | null
  event_id?: string | null
  event_name?: string | null
}): boolean {
  return offer.offer_type === 'set' || Boolean(offer.event_id) || Boolean(offer.event_name)
}

/** Название похоже на фестивальный сет («Сет №1»), а не на клубный подарок. */
function looksLikeSetTitle(offerTitle: string): boolean {
  return /^сет\b/i.test(offerTitle.trim().replace(/\s*в подарок\s*$/i, ''))
}

function formatGiftTitle(offerTitle: string): string {
  const cleaned = offerTitle.replace(/\s*в подарок\s*$/i, '').trim() || offerTitle
  // Не клеим «в подарок» к сетам, даже если в БД тип ещё compliment
  if (looksLikeSetTitle(cleaned)) {
    return formatSetOfferTitle(null, { showNumber: true, offerTitle: cleaned })
  }
  return `${cleaned} в подарок`
}

export function formatOfferHeadline(
  offerType: OfferType,
  offerTitle: string,
  eventName?: string | null,
  options?: { showSetNumber?: boolean; setIndex?: number },
): string {
  if (offerType === '2for1') return `1+1 · ${offerTitle}`
  if (isFestivalSetOffer({ offer_type: offerType, event_name: eventName })) {
    return formatSetOfferTitle(eventName, {
      showNumber: options?.showSetNumber,
      offerTitle,
      index: options?.setIndex,
    })
  }
  return formatGiftTitle(offerTitle)
}

/** Развёрнутый заголовок оффера: «1+1 · …» / «{event} сет» / «{название} в подарок». */
export function formatOfferTitle(
  offerType: OfferType,
  offerTitle: string,
  eventName?: string | null,
  options?: { showSetNumber?: boolean; setIndex?: number },
): string {
  if (offerType === '2for1') return `1+1 · ${offerTitle}`
  if (isFestivalSetOffer({ offer_type: offerType, event_name: eventName })) {
    return formatSetOfferTitle(eventName, {
      showNumber: options?.showSetNumber,
      offerTitle,
      index: options?.setIndex,
    })
  }
  return formatGiftTitle(offerTitle)
}

/** Лейбл плашки оффера на карточке заведения (только клубные). */
export function formatOfferChipLabel(offerType: OfferType, offerTitle: string): string {
  if (offerType === '2for1') return `1+1 · ${offerTitle}`
  if (offerType === 'set' || looksLikeSetTitle(offerTitle)) {
    return formatSetOfferTitle(null, { showNumber: true, offerTitle })
  }
  return formatGiftTitle(offerTitle)
}

type OfferLike = {
  offer_type: OfferType
  is_active: boolean
  estimated_value?: number | null
  event_id?: string | null
  offer_title?: string | null
}

/** Сначала 1+1, потом подарки; сеты в основном каталоге не как главные чипы. */
export function pickTopOffers<T extends OfferLike>(offers: T[], maxN = 3): T[] {
  const active = offers.filter(
    (offer) =>
      offer.is_active
      && offer.offer_type !== 'set'
      && !offer.event_id,
  )
  const twoFor1 = active.filter((offer) => offer.offer_type === '2for1')
  const compliments = active.filter((offer) => offer.offer_type === 'compliment')
  return [...twoFor1, ...compliments].slice(0, maxN)
}

export function pickClubOffers<T extends OfferLike>(offers: T[]): T[] {
  return offers.filter(
    (offer) =>
      offer.is_active
      && !offer.event_id
      && (offer.offer_type === '2for1' || offer.offer_type === 'compliment'),
  )
}

export function pickSetOffers<T extends OfferLike>(offers: T[]): T[] {
  return offers.filter(
    (offer) => offer.is_active && isFestivalSetOffer(offer),
  )
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
