export const META_PURCHASE_VALUE_KZT = 1990
export const META_PURCHASE_CURRENCY = 'KZT'

export function buildPurchaseEventId(userId: string, eventTime: number): string {
  return `purchase_${userId}_${eventTime}`
}
