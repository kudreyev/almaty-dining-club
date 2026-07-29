/** UTM / promo attribution для TipTop JsonData и cookie. */

export const UTM_COOKIE_NAME = 'kc_utm'
export const UTM_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60 // 30 дней

export type UtmAttribution = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  promo_code: string | null
}

const EMPTY: UtmAttribution = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  promo_code: null,
}

function clean(value: unknown, max = 128): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

/** Читает utm_* и promo/promo_code из query-параметров URL. */
export function parseUtmFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): UtmAttribution {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return clean(params.get(key))
    const raw = params[key]
    if (Array.isArray(raw)) return clean(raw[0])
    return clean(raw)
  }

  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    promo_code: get('promo_code') ?? get('promo'),
  }
}

export function hasAnyUtm(a: UtmAttribution): boolean {
  return Boolean(a.utm_source || a.utm_medium || a.utm_campaign || a.promo_code)
}

export function serializeUtmCookie(a: UtmAttribution): string {
  return JSON.stringify({
    utm_source: a.utm_source,
    utm_medium: a.utm_medium,
    utm_campaign: a.utm_campaign,
    promo_code: a.promo_code,
  })
}

export function parseUtmCookieValue(raw: string | null | undefined): UtmAttribution {
  if (!raw) return { ...EMPTY }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
    return {
      utm_source: clean(parsed.utm_source),
      utm_medium: clean(parsed.utm_medium),
      utm_campaign: clean(parsed.utm_campaign),
      promo_code: clean(parsed.promo_code),
    }
  } catch {
    return { ...EMPTY }
  }
}

/**
 * Достаёт атрибуцию из TipTop webhook JsonData (строка JSON или уже объект).
 * Поддерживает плоские поля и вложенный metadata/utm.
 */
export function parseUtmFromJsonData(raw: unknown): UtmAttribution {
  if (raw == null || raw === '') return { ...EMPTY }

  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return { ...EMPTY }
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>
  } else {
    return { ...EMPTY }
  }

  const nested =
    (typeof obj.utm === 'object' && obj.utm && !Array.isArray(obj.utm)
      ? (obj.utm as Record<string, unknown>)
      : null) ??
    (typeof obj.metadata === 'object' && obj.metadata && !Array.isArray(obj.metadata)
      ? (obj.metadata as Record<string, unknown>)
      : null)

  const pick = (key: string): string | null =>
    clean(obj[key]) ?? (nested ? clean(nested[key]) : null)

  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    promo_code: pick('promo_code') ?? pick('promo'),
  }
}
