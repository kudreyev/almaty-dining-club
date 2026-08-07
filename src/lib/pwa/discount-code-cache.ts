/** Кэш последнего кода скидки (redeem token) для офлайн-показа в PWA. */

export const DISCOUNT_CODE_STORAGE_KEY = 'kudaclub:last_discount_code'

export type CachedDiscountCode = {
  tokenCode: string
  status: string
  expiresAt: string | null
  restaurantName: string | null
  offerTitle: string | null
  savedAt: string
}

export function saveCachedDiscountCode(code: CachedDiscountCode): void {
  try {
    window.localStorage.setItem(DISCOUNT_CODE_STORAGE_KEY, JSON.stringify(code))
  } catch {
    // ignore
  }
}

export function readCachedDiscountCode(): CachedDiscountCode | null {
  try {
    const raw = window.localStorage.getItem(DISCOUNT_CODE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedDiscountCode
    if (!parsed || typeof parsed.tokenCode !== 'string') return null
    return parsed
  } catch {
    return null
  }
}
