import {
  DEFAULT_CITY,
  isCity,
  type City,
} from '@/lib/cities'

/**
 * Город для /free:
 * 1) ?city=astana|almaty
 * 2) utm_source=qr_astana → Астана; qr / qr_almaty → Алматы
 * 3) иначе DEFAULT_CITY
 */
export function resolveFreeCity(
  cityParam: string | null | undefined,
  utmSource: string | null | undefined,
): City {
  if (isCity(cityParam)) return cityParam

  const src = (utmSource ?? '').trim().toLowerCase()
  if (src === 'qr_astana' || src === 'qr-astana') return 'astana'
  if (src === 'qr_almaty' || src === 'qr-almaty' || src === 'qr') {
    return 'almaty'
  }
  return DEFAULT_CITY
}
