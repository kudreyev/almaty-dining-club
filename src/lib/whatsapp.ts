export const KUDACLUB_WHATSAPP_PHONE = '77066059899'

function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${KUDACLUB_WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
}

/** Заявка заведения на подключение (кнопка «Стать партнёром»). */
export function buildPartnerWhatsAppUrl(): string {
  return buildWhatsAppUrl('Здравствуйте! Хочу подключить заведение к KudaClub.')
}
