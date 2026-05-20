export const META_SUBSCRIPTION_PRICE_KZT = 1990
export const META_OFFER_DEFAULT_VALUE_KZT = 2500

export type MetaPixelStandardEvent =
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'

export type MetaPixelEventParams = Record<
  string,
  string | number | string[] | undefined
>

const FBQ_RETRY_MS = 100
const FBQ_MAX_RETRIES = 50

function fireMetaPixel(
  event: MetaPixelStandardEvent,
  params?: MetaPixelEventParams,
): boolean {
  if (typeof window.fbq !== 'function') return false
  window.fbq('track', event, params)
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
