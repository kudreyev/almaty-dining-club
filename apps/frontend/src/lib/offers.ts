import { ruDayWordAfterNumber } from '@/lib/ru-plural'

export const DEFAULT_OFFER_COOLDOWN_DAYS = 7

export type OfferType = '2for1' | 'compliment'

export function formatOfferHeadline(offerType: OfferType, offerTitle: string): string {
  return offerType === '2for1'
    ? `2за1 · ${offerTitle}`
    : `${offerTitle} в подарок`
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
