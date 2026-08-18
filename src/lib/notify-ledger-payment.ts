import {
  notifySubscriberGained,
  notifySubscriptionRenewed,
} from '@/lib/analytics-telegram'
import type { PaymentRecordResult } from '@/lib/ttp-analytics-ledger'

/** Telegram после успешного ledger-платежа (не дубликаты). */
export function notifyLedgerPaymentResult(
  result: PaymentRecordResult,
  amount: number,
): void {
  if (result.duplicate) return
  if (result.created || result.reactivated) {
    void notifySubscriberGained(result.subscriber, {
      amount,
      reactivated: result.reactivated,
    })
    return
  }
  void notifySubscriptionRenewed({
    amount,
    subscriber: result.subscriber,
  })
}
