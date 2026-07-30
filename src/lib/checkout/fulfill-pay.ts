/**
 * Обработка успешного Pay: pending_checkout → user → subscriptions + ledger + WA.
 * AccountId теперь телефон (+7…); UUID оставлен для старых рекуррентов.
 */

import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { ensureUserIdForPhone } from '@/lib/checkout/create-session'
import {
  attributionFromPending,
  findPendingCheckoutByPhone,
  markPendingCheckoutPaid,
  type PendingCheckoutRow,
} from '@/lib/checkout/pending-checkouts'
import { sendAccessAfterPayment } from '@/lib/messaging/access-messaging'
import {
  activateProductSubscription,
  isValidUserAccountId,
} from '@/lib/tiptoppay-product'
import {
  recordSuccessfulPayment,
  type PaymentRecordResult,
} from '@/lib/ttp-analytics-ledger'
import { notifyLedgerPaymentResult } from '@/lib/notify-ledger-payment'
import { parseAmount, parseWebhookJsonData } from '@/lib/ttp-webhook-utils'
import { hasAnyUtm, parseUtmFromJsonData, type UtmAttribution } from '@/lib/utm'
import { isTipTopInstallmentInvoiceId } from '@/lib/meta-purchase'
import { incrementPromoCodeUsage } from '@/lib/promo-codes'
import { logServerError } from '@/lib/safe-errors'

const PHONE_ACCOUNT_RE = /^\+7\d{10}$/

export function isPhoneAccountId(accountId: string | null | undefined): boolean {
  if (!accountId) return false
  const normalized = normalizePhoneToE164(accountId) ?? accountId
  return PHONE_ACCOUNT_RE.test(normalized)
}

function mergeAttribution(
  fromPending: UtmAttribution | null,
  fromJson: UtmAttribution,
): UtmAttribution {
  if (!fromPending || !hasAnyUtm(fromPending)) return fromJson
  return {
    utm_source: fromJson.utm_source ?? fromPending.utm_source,
    utm_medium: fromJson.utm_medium ?? fromPending.utm_medium,
    utm_campaign: fromJson.utm_campaign ?? fromPending.utm_campaign,
    promo_code: fromJson.promo_code ?? fromPending.promo_code,
  }
}

export type PayFulfillmentResult = {
  userId: string | null
  ledger: PaymentRecordResult | null
  pending: PendingCheckoutRow | null
}

/**
 * Идемпотентная обработка Pay-вебхука.
 * ledger keyed by TransactionId; product — по user UUID.
 */
export async function fulfillSuccessfulPay(
  p: Record<string, string>,
): Promise<PayFulfillmentResult> {
  const rawAccountId = p.AccountId?.trim() || null
  const transactionId = p.TransactionId?.trim() || null
  const status = p.Status

  if (status && status !== 'Completed' && status !== 'Authorized') {
    return { userId: null, ledger: null, pending: null }
  }

  if (!rawAccountId || !transactionId) {
    logServerError(
      'fulfillSuccessfulPay',
      new Error(`missing AccountId/TransactionId: ${rawAccountId}/${transactionId}`),
    )
    return { userId: null, ledger: null, pending: null }
  }

  let userId: string | null = null
  let pending: PendingCheckoutRow | null = null
  let ttpAccountId = rawAccountId
  let phoneForMessage: string | null = null
  let attributionOverride: UtmAttribution | null = null
  let justPaidPending = false

  if (isValidUserAccountId(rawAccountId)) {
    userId = rawAccountId
    phoneForMessage = p.Phone?.trim() || null
  } else if (isPhoneAccountId(rawAccountId)) {
    const phone = normalizePhoneToE164(rawAccountId)!
    ttpAccountId = phone
    phoneForMessage = phone
    pending = await findPendingCheckoutByPhone(phone)
    userId = await ensureUserIdForPhone(phone)

    if (pending && pending.status === 'pending') {
      pending = await markPendingCheckoutPaid({ id: pending.id, userId })
      attributionOverride = attributionFromPending(pending)
      justPaidPending = true
    } else if (pending) {
      if (pending.user_id) userId = pending.user_id
      attributionOverride = attributionFromPending(pending)
    }
  } else {
    logServerError(
      'fulfillSuccessfulPay',
      new Error(`unrecognized AccountId: ${rawAccountId}`),
    )
  }

  if (userId) {
    await activateProductSubscription({
      accountId: userId,
      subscriptionId: p.SubscriptionId || null,
      invoiceId: p.InvoiceId || null,
      phoneHint: phoneForMessage,
    })
  }

  const jsonData = parseWebhookJsonData(p)
  const merged = mergeAttribution(
    attributionOverride,
    parseUtmFromJsonData(jsonData),
  )

  let ledger: PaymentRecordResult | null = null
  try {
    ledger = await recordSuccessfulPayment({
      ttpAccountId,
      ttpTransactionId: transactionId,
      amount: parseAmount(p.Amount),
      email: p.Email || null,
      phone: phoneForMessage || p.Phone || null,
      jsonData: {
        ...(typeof jsonData === 'object' && jsonData && !Array.isArray(jsonData)
          ? (jsonData as Record<string, unknown>)
          : {}),
        ...merged,
      },
      rawPayload: p,
    })
    notifyLedgerPaymentResult(ledger, parseAmount(p.Amount))
  } catch (ledgerError) {
    logServerError('fulfillSuccessfulPay:ledger', ledgerError)
  }

  // used_count только после подтверждённой оплаты и только для установочного
  // платежа (не рекуррент). Дубликат вебхука не инкрементирует повторно.
  const promoForUsage = merged.promo_code
  if (
    promoForUsage &&
    ledger &&
    !ledger.duplicate &&
    isTipTopInstallmentInvoiceId(p.InvoiceId)
  ) {
    try {
      await incrementPromoCodeUsage(promoForUsage)
    } catch (promoError) {
      logServerError('fulfillSuccessfulPay:promo_usage', promoError)
    }
  }

  const shouldNotifyAccess =
    ledger &&
    !ledger.duplicate &&
    phoneForMessage &&
    (justPaidPending ||
      ledger.created ||
      ledger.reactivated ||
      isTipTopInstallmentInvoiceId(p.InvoiceId))

  if (shouldNotifyAccess && phoneForMessage) {
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    void sendAccessAfterPayment({
      phoneE164: phoneForMessage,
      endDateIso: endDate.toISOString().slice(0, 10),
      transactionId,
    })
  }

  return { userId, ledger, pending }
}
