import type { Metadata } from 'next'
import { CITY_LABELS_GENITIVE, CITY_LABELS_PREPOSITIONAL, type City } from '@/lib/cities'
import type { OfferType } from '@/lib/offers'
import { pluralizeRu } from '@/lib/ru-plural'

export const SITE_URL = 'https://kudaclub.kz'
export const SITE_NAME = 'KudaClub'

export const SITE_TITLE = 'KudaClub: 1+1 в кафе и ресторанах Алматы и Астаны бесплатно'
export const SITE_DESCRIPTION =
  'Бесплатные предложения 1+1, напитки и десерты в кафе и ресторанах Алматы и Астаны. Без подписки и приложения.'

/** title + description, а Open Graph и Twitter повторяют их же. */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path?: string
}): Metadata {
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title,
      description,
      ...(path ? { url: path } : {}),
      siteName: SITE_NAME,
      locale: 'ru_RU',
      type: 'website',
    },
    twitter: { card: 'summary', title, description },
  }
}

export function cityTitle(city: City): string {
  return `KudaClub: 1+1 в кафе и ресторанах в ${CITY_LABELS_PREPOSITIONAL[city]} бесплатно`
}

/** venuesCount — активные заведения города; без числа, если его не удалось получить. */
export function cityDescription(city: City, venuesCount?: number | null): string {
  const venues =
    venuesCount && venuesCount > 0
      ? `в ${venuesCount} ${pluralizeRu(venuesCount, ['заведении', 'заведениях', 'заведениях'])}`
      : 'в лучших заведениях'
  return `Бесплатные предложения 1+1, напитки и десерты ${venues} ${CITY_LABELS_GENITIVE[city]}. Без подписки и приложения.`
}

export function cityMapTitle(city: City): string {
  return `Карта заведений KudaClub в ${CITY_LABELS_PREPOSITIONAL[city]}: 1+1 бесплатно`
}

export function cityMapDescription(city: City): string {
  return `Все заведения KudaClub в ${CITY_LABELS_PREPOSITIONAL[city]} на карте: предложения 1+1, напитки и десерты бесплатно.`
}

type MetaOffer = { offer_type: OfferType; offer_title: string }

/** Названия и адреса из админки бывают с невидимыми символами и лишними пробелами. */
function cleanText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .trim()
}

/** «Паста 1+1», «Кофе в подарок», «Сеты Kudafest». */
export function offerMetaPhrase(offer: MetaOffer): string {
  const title = cleanText(offer.offer_title)
  if (offer.offer_type === '2for1') return `${title} 1+1`
  if (offer.offer_type === 'kudafest_set') return 'Сеты Kudafest'
  return `${title} в подарок`
}

export function restaurantTitle(rawName: string, offer: MetaOffer | null): string {
  const name = cleanText(rawName)
  if (!offer) return `${name} | ${SITE_NAME}`
  // Сеты Kudafest продаются по фестивальной цене — «бесплатно» к ним не пишем.
  if (offer.offer_type === 'kudafest_set') return `${name}: сеты Kudafest | ${SITE_NAME}`
  return `${name}: ${offerMetaPhrase(offer)} бесплатно | ${SITE_NAME}`
}

export function restaurantDescription(
  name: string,
  address: string | null | undefined,
  offer: MetaOffer | null,
): string {
  const place = [cleanText(name), cleanText(address)].filter(Boolean).join(', ')
  const lead = offer ? `${offerMetaPhrase(offer)} в ${place}` : place
  return `${lead}. Получите код на KudaClub и покажите официанту.`
}
