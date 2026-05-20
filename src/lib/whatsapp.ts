export const KUDACLUB_WHATSAPP_PHONE = '77066059899'

export function buildKudaclubSubscribeMessage(source: string): string {
  return `Здравствуйте! Хочу подписку Kudaclub [ref: ${source}]`
}

export function buildKudaclubSubscribeWhatsAppUrl(source: string): string {
  return `https://wa.me/${KUDACLUB_WHATSAPP_PHONE}?text=${encodeURIComponent(
    buildKudaclubSubscribeMessage(source),
  )}`
}

export function venueCtaSource(slug: string): string {
  return `venue-cta-${slug}`
}

export function offerCardSource(slug: string, offerId: string): string {
  return `offer-card-${slug}-${offerId}`
}
