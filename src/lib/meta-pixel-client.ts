export const META_SUBSCRIPTION_PRICE_KZT = 1990
export const META_OFFER_DEFAULT_VALUE_KZT = 2500

export type MetaPixelStandardEvent =
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'StartTrial'

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

function isValidMetaPixelEventId(eventId: string): boolean {
  return typeof eventId === 'string' && eventId.trim().length > 0
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

function fireMetaPixelWithEventId(
  event: MetaPixelStandardEvent,
  params: MetaPixelEventParams | undefined,
  eventId: string,
): boolean {
  if (typeof window.fbq !== 'function') return false
  if (!isValidMetaPixelEventName(event) || !isValidMetaPixelEventId(eventId)) return false
  window.fbq('track', event, normalizeMetaPixelParams(params), { eventID: eventId.trim() })
  return true
}

/** Ждёт загрузки fbevents.js — иначе useEffect на mount часто срабатывает раньше afterInteractive. */
function fireMetaPixelPurchase(
  params: MetaPixelEventParams,
  eventId: string,
): boolean {
  return fireMetaPixelWithEventId('Purchase', params, eventId)
}

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

export function trackMetaPixelPurchase(
  params: MetaPixelEventParams,
  eventId: string,
): void {
  if (typeof window === 'undefined') return
  if (!isValidMetaPixelEventId(eventId)) return
  if (fireMetaPixelPurchase(params, eventId)) return

  let attempts = 0
  const timer = window.setInterval(() => {
    if (fireMetaPixelPurchase(params, eventId) || ++attempts >= FBQ_MAX_RETRIES) {
      window.clearInterval(timer)
    }
  }, FBQ_RETRY_MS)
}

function trackMetaPixelWithEventId(
  event: MetaPixelStandardEvent,
  params: MetaPixelEventParams | undefined,
  eventId: string,
): void {
  if (typeof window === 'undefined') return
  if (fireMetaPixelWithEventId(event, params, eventId)) return

  let attempts = 0
  const timer = window.setInterval(() => {
    if (fireMetaPixelWithEventId(event, params, eventId) || ++attempts >= FBQ_MAX_RETRIES) {
      window.clearInterval(timer)
    }
  }, FBQ_RETRY_MS)
}

export function trackMetaPixelInitiateCheckout(
  params: MetaPixelEventParams,
  eventId: string,
): void {
  if (!isValidMetaPixelEventId(eventId)) return
  trackMetaPixelWithEventId('InitiateCheckout', params, eventId)
}

/** Триальная активация — не Purchase; value: 0, чтобы Meta не оптимизировала на «бесплатные покупки». */
export function trackMetaPixelStartTrial(
  params: MetaPixelEventParams,
  eventId: string,
): void {
  if (!isValidMetaPixelEventId(eventId)) return
  trackMetaPixelWithEventId('StartTrial', params, eventId)
}
