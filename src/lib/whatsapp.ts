export const KUDACLUB_WHATSAPP_PHONE = '77066059899'

export const KUDACLUB_SUBSCRIBE_TEXT = 'Здравствуйте! Хочу подписку Kudaclub'

export function buildKudaclubSubscribeWhatsAppUrl(text: string = KUDACLUB_SUBSCRIBE_TEXT): string {
  return `https://wa.me/${KUDACLUB_WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
}

export const KUDACLUB_SUBSCRIBE_WHATSAPP_URL = buildKudaclubSubscribeWhatsAppUrl()
