export const META_PURCHASE_VALUE_KZT = 1990
export const META_PURCHASE_CURRENCY = 'KZT'

export function buildPurchaseEventId(userId: string, eventTime: number): string {
  return `purchase_${userId}_${eventTime}`
}

export function buildTrialEventId(userId: string, eventTime: number): string {
  return `trial_${userId}_${eventTime}`
}

/** source — trackGoal `whatsapp_click.source` (может содержать slug). */
export function buildInitiateCheckoutEventId(source: string, eventTime: number): string {
  const safeSource = source.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  return `checkout_${safeSource}_${eventTime}`
}
