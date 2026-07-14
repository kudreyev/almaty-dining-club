/**
 * Города каталога. Город — это фильтр контента (заведения), а НЕ часть модели
 * подписки: подписка общая на все города.
 */
export const CITIES = ['almaty', 'astana'] as const

export type City = (typeof CITIES)[number]

export const DEFAULT_CITY: City = 'almaty'

/** Имя cookie с выбранным городом. */
export const CITY_COOKIE = 'kuda_city'

/** Срок жизни cookie города — 1 год (в секундах). */
export const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const CITY_LABELS: Record<City, string> = {
  almaty: 'Алматы',
  astana: 'Астана',
}

/** Родительный падеж для фраз вида «12 заведений {города}». */
export const CITY_LABELS_GENITIVE: Record<City, string> = {
  almaty: 'Алматы',
  astana: 'Астаны',
}

/** Предложный падеж для фраз вида «в {городе}». */
export const CITY_LABELS_PREPOSITIONAL: Record<City, string> = {
  almaty: 'Алматы',
  astana: 'Астане',
}

export function isCity(value: unknown): value is City {
  return typeof value === 'string' && (CITIES as readonly string[]).includes(value)
}
