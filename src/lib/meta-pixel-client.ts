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

export function trackMetaPixel(
  event: MetaPixelStandardEvent,
  params?: MetaPixelEventParams,
): void {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return
  window.fbq('track', event, params)
}
