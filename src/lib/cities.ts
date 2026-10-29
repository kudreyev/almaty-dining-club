/**
 * Города каталога. Город — это фильтр контента (заведения), доступ общий на все города.
 */
export const CITIES = ['almaty', 'astana'] as const

export type City = (typeof CITIES)[number]

export const DEFAULT_CITY: City = 'almaty'

/** Имя cookie с городом, который пользователь выбрал вручную. */
export const CITY_COOKIE = 'kc_city'

/** Прежнее имя cookie города: читаем, чтобы не потерять выбор старых посетителей. */
export const LEGACY_CITY_COOKIE = 'kuda_city'

/** Срок жизни cookie города — 1 год (в секундах). */
export const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Город определён по IP при заходе на «/»: шапка один раз спросит «Ваш город …?». */
export const CITY_HINT_COOKIE = 'kc_city_hint'

/** Подсказку уже показывали — больше не показываем. */
export const CITY_HINT_SEEN_COOKIE = 'kc_city_hint_seen'

/** Заголовок запроса, через который middleware передаёт город текущей страницы. */
export const CITY_REQUEST_HEADER = 'x-kc-city'

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

/** Город из первого сегмента пути: «/astana/map» → astana. */
export function cityFromPathname(pathname: string): City | null {
  const segment = pathname.split('/')[1]
  return isCity(segment) ? segment : null
}

const GEO_CITY_NAMES: Record<string, City> = {
  almaty: 'almaty',
  'alma-ata': 'almaty',
  алматы: 'almaty',
  'алма-ата': 'almaty',
  astana: 'astana',
  'nur-sultan': 'astana',
  nursultan: 'astana',
  akmola: 'astana',
  tselinograd: 'astana',
  астана: 'astana',
  'нур-султан': 'astana',
}

/**
 * ISO 3166-2:KZ (x-vercel-ip-country-region): 75 — г. Алматы, 19 — Алматинская обл.,
 * 71 — г. Астана, 11 — Акмолинская обл.
 */
const KZ_REGION_CITIES: Record<string, City> = {
  '75': 'almaty',
  '19': 'almaty',
  '71': 'astana',
  '11': 'astana',
}

function decodeGeoHeader(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value).trim().toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

/**
 * Город по гео-заголовкам хостинга (Vercel: x-vercel-ip-city / -country-region / -country;
 * Cloudflare: cf-ipcity). null — город не определился или не поддерживается.
 */
export function cityFromGeo(geo: {
  city?: string | null
  region?: string | null
  country?: string | null
}): City | null {
  const byName = GEO_CITY_NAMES[decodeGeoHeader(geo.city).replace(/\s+/g, '-')]
  if (byName) return byName

  const country = decodeGeoHeader(geo.country)
  const region = decodeGeoHeader(geo.region).replace(/^kz-/, '')
  if (country === 'kz' && region) {
    return KZ_REGION_CITIES[region] ?? null
  }
  return null
}

const BOT_USER_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|googlebot|google-inspectiontool|yandex(bot|images|metrika|direct)|bingpreview|duckduckgo|baidu|applebot|petalbot|facebookexternalhit|facebookcatalog|telegrambot|whatsapp|twitterbot|linkedinbot|discordbot|skypeuripreview|vkshare|semrush|ahrefs|mj12bot|headlesschrome|lighthouse/i

/** Поисковые роботы и превью мессенджеров: им «/» отдаём без редиректа. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && BOT_USER_AGENT.test(userAgent))
}
