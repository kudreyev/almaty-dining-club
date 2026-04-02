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
  return `~${formatted} ₸ выгода`
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

export function formatOfferCooldownText(cooldownDays?: number | null): string {
  const days = resolveOfferCooldownDays(cooldownDays)
  return days === 1
    ? 'Можно получить: 1 раз в день'
    : `Можно получить: 1 раз в ${days} дней`
}
