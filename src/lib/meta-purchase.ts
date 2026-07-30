import { PRICE_KZT } from '@/lib/pricing'

export const META_PURCHASE_VALUE_KZT = PRICE_KZT
export const META_PURCHASE_CURRENCY = 'KZT'

/** TipTop widget externalId / webhook InvoiceId для установочного платежа. */
const TIPTOP_INSTALLMENT_INVOICE_RE = /^sub_/

export function buildPurchaseEventId(userId: string, eventTime: number): string {
  return `purchase_${userId}_${eventTime}`
}

export function buildTrialEventId(userId: string, eventTime: number): string {
  return `trial_${userId}_${eventTime}`
}

/** source — trackGoal `cta_click` / `checkout_opened` (может содержать slug). */
export function buildInitiateCheckoutEventId(source: string, eventTime: number): string {
  const safeSource = source.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  return `checkout_${safeSource}_${eventTime}`
}

/**
 * Стабильный eventID для дедупа Pixel ↔ CAPI на TipTop-оплате.
 * invoiceId — widget `externalId` (= webhook `InvoiceId`).
 */
export function buildTipTopPurchaseEventId(invoiceId: string): string {
  const safe = invoiceId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
  return `purchase_tiptop_${safe}`
}

/** Установочный платёж виджета (`sub_${userId}_${ts}`), не рекуррент. */
export function isTipTopInstallmentInvoiceId(
  invoiceId: string | null | undefined,
): invoiceId is string {
  return typeof invoiceId === 'string' && TIPTOP_INSTALLMENT_INVOICE_RE.test(invoiceId.trim())
}
