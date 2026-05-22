export const KUDACLUB_WHATSAPP_PHONE = '77066059899'

/**
 * Базовый «kind» для выбора текста сообщения в WhatsApp.
 * Не путать с `source` для trackGoal — там source может включать slug
 * (`venue-cta-${slug}`, `offer-card-${slug}-${offerId}`).
 */
export type WhatsAppMessageKind =
  | 'header-cta'
  | 'home-hero'
  | 'home-pricing'
  | 'pricing-page'
  | 'venue-cta'
  | 'offer-card'
  | 'me-no-sub'
  | 'me-expired'
  | 'mobile-menu-cta'
  | 'login-no-account'
  | 'home-trial-upgrade'

const DEFAULT_TEXT = 'Здравствуйте! Хочу подписку Kudaclub'

function getWhatsAppText(
  kind?: WhatsAppMessageKind,
  restaurantName?: string,
): string {
  switch (kind) {
    case 'header-cta':
    case 'mobile-menu-cta':
      return 'Здравствуйте! Интересует подписка Kudaclub'

    case 'home-hero':
    case 'me-no-sub':
    case 'login-no-account':
      return DEFAULT_TEXT

    case 'home-pricing':
    case 'pricing-page':
    case 'home-trial-upgrade':
      return 'Здравствуйте! Хочу оформить подписку Kudaclub'

    case 'venue-cta':
    case 'offer-card':
      return restaurantName
        ? `Здравствуйте! Хочу подписку Kudaclub. Хочу попробовать ${restaurantName}`
        : DEFAULT_TEXT

    case 'me-expired':
      return 'Здравствуйте! Хочу продлить подписку Kudaclub'

    default:
      return DEFAULT_TEXT
  }
}

export function buildKudaclubSubscribeWhatsAppUrl(
  kind?: WhatsAppMessageKind,
  restaurantName?: string,
): string {
  return `https://wa.me/${KUDACLUB_WHATSAPP_PHONE}?text=${encodeURIComponent(
    getWhatsAppText(kind, restaurantName),
  )}`
}

/** Идентификаторы для Яндекс.Метрики (whatsapp_click.source), не в тексте WA. */
export function venueCtaSource(slug: string): string {
  return `venue-cta-${slug}`
}

export function offerCardSource(slug: string, offerId: string): string {
  return `offer-card-${slug}-${offerId}`
}
