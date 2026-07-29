import {
  notifySubscriberGained,
  notifySubscriptionRenewed,
} from '@/lib/analytics-telegram'
import {
  attributionLabel,
  type PaymentRecordResult,
} from '@/lib/ttp-analytics-ledger'

/** Telegram после успешного ledger-платежа (не дубликаты). */
export function notifyLedgerPaymentResult(
  result: PaymentRecordResult,
  amount: number,
): void {
  if (result.duplicate) return
  if (result.created || result.reactivated) {
    void notifySubscriberGained(result.subscriber)
    return
  }
  void notifySubscriptionRenewed({
    amount,
    source: attributionLabel(result.subscriber),
  })
}
