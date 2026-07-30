/**
 * Refund в analytics ledger: payment → refunded; первый платёж → subscriber cancelled.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { SubscriberRow } from '@/lib/ttp-analytics-ledger'

function admin() {
  return createSupabaseAdminClient()
}

export type RefundLedgerResult = {
  paymentId: string | null
  subscriber: SubscriberRow | null
  cancelledSubscriber: boolean
  duplicate: boolean
}

export async function recordRefundedPayment(args: {
  ttpAccountId: string
  /** TransactionId возврата (новый). */
  refundTransactionId: string | null
  /** OriginalTransactionId — исходный успешный платёж. */
  originalTransactionId: string | null
  rawPayload: Record<string, string>
}): Promise<RefundLedgerResult> {
  const db = admin()

  let payment:
    | {
        id: string
        subscriber_id: string
        status: string
        created_at: string
      }
    | null = null

  if (args.originalTransactionId) {
    const { data } = await db
      .from('payments')
      .select('id, subscriber_id, status, created_at')
      .eq('ttp_transaction_id', args.originalTransactionId)
      .maybeSingle<{
        id: string
        subscriber_id: string
        status: string
        created_at: string
      }>()
    payment = data ?? null
  }

  // Fallback: ищем подписчика по AccountId и последний success.
  if (!payment) {
    const { data: sub } = await db
      .from('subscribers')
      .select('id')
      .eq('ttp_account_id', args.ttpAccountId)
      .maybeSingle<{ id: string }>()
    if (sub) {
      const { data } = await db
        .from('payments')
        .select('id, subscriber_id, status, created_at')
        .eq('subscriber_id', sub.id)
        .eq('status', 'success')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle<{
          id: string
          subscriber_id: string
          status: string
          created_at: string
        }>()
      payment = data ?? null
    }
  }

  if (!payment) {
    return {
      paymentId: null,
      subscriber: null,
      cancelledSubscriber: false,
      duplicate: false,
    }
  }

  if (payment.status === 'refunded') {
    const { data: sub } = await db
      .from('subscribers')
      .select('*')
      .eq('id', payment.subscriber_id)
      .maybeSingle<SubscriberRow>()
    return {
      paymentId: payment.id,
      subscriber: sub,
      cancelledSubscriber: false,
      duplicate: true,
    }
  }

  await db
    .from('payments')
    .update({
      status: 'refunded',
      raw_json: args.rawPayload,
    })
    .eq('id', payment.id)

  // Первый успешный платёж подписчика?
  const { data: firstSuccess } = await db
    .from('payments')
    .select('id')
    .eq('subscriber_id', payment.subscriber_id)
    .in('status', ['success', 'refunded'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>()

  const isFirstPayment = firstSuccess?.id === payment.id
  let cancelledSubscriber = false
  let subscriber: SubscriberRow | null = null

  if (isFirstPayment) {
    const { data, error } = await db
      .from('subscribers')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.subscriber_id)
      .select('*')
      .single<SubscriberRow>()
    if (error) throw error
    subscriber = data
    cancelledSubscriber = true
  } else {
    const { data } = await db
      .from('subscribers')
      .select('*')
      .eq('id', payment.subscriber_id)
      .maybeSingle<SubscriberRow>()
    subscriber = data
  }

  return {
    paymentId: payment.id,
    subscriber,
    cancelledSubscriber,
    duplicate: false,
  }
}
