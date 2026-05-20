export const KUDACLUB_WHATSAPP_PHONE = '77066059899'

export const KUDACLUB_SUBSCRIBE_MESSAGE = 'Здравствуйте! Хочу подписку Kudaclub'

export function buildKudaclubSubscribeWhatsAppUrl(): string {
  return `https://wa.me/${KUDACLUB_WHATSAPP_PHONE}?text=${encodeURIComponent(
    KUDACLUB_SUBSCRIBE_MESSAGE,
  )}`
}

/** Идентификаторы для Яндекс.Метрики (whatsapp_click.source), не в тексте WA. */
export function venueCtaSource(slug: string): string {
  return `venue-cta-${slug}`
}

export function offerCardSource(slug: string, offerId: string): string {
  return `offer-card-${slug}-${offerId}`
}
