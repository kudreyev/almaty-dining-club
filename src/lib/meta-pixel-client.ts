export const META_OFFER_DEFAULT_VALUE_KZT = 2500

export type MetaPixelStandardEvent =
  | 'ViewContent'
  | 'AddToCart'
  | 'CompleteRegistration'

export type MetaPixelEventParams = Record<
  string,
  string | number | string[] | undefined
>

const FBQ_RETRY_MS = 100
const FBQ_MAX_RETRIES = 50

function normalizeMetaPixelParams(
  params?: MetaPixelEventParams,
): MetaPixelEventParams {
  if (!params) return {}
  const normalized: MetaPixelEventParams = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) normalized[key] = value
  }
  return normalized
}

function isValidMetaPixelEventName(event: string): event is MetaPixelStandardEvent {
  return typeof event === 'string' && event.trim().length > 0
}

function fireMetaPixel(
  event: MetaPixelStandardEvent,
  params?: MetaPixelEventParams,
): boolean {
  if (typeof window.fbq !== 'function') return false
  if (!isValidMetaPixelEventName(event)) return false
  // Всегда объект: undefined params + { eventID } ломает arity и даёт __missing_event.
  window.fbq('track', event, normalizeMetaPixelParams(params))
  return true
}

/** Ждёт загрузки fbevents.js — иначе useEffect на mount часто срабатывает раньше afterInteractive. */
export function trackMetaPixel(
  event: MetaPixelStandardEvent,
  params?: MetaPixelEventParams,
): void {
  if (typeof window === 'undefined') return
  if (fireMetaPixel(event, params)) return

  let attempts = 0
  const timer = window.setInterval(() => {
    if (fireMetaPixel(event, params) || ++attempts >= FBQ_MAX_RETRIES) {
      window.clearInterval(timer)
    }
  }, FBQ_RETRY_MS)
}
