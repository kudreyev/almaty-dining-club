import { DEFAULT_TZ } from '@/lib/opening-hours'
import { ruDayWordAfterNumber } from '@/lib/ru-plural'

export const DEFAULT_OFFER_COOLDOWN_DAYS = 7

export type OfferType = '2for1' | 'compliment' | 'kudafest_set'

export type CatalogOfferLike = {
  is_active: boolean
  end_date?: string | null
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
