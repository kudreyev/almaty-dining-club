// src/app/api/tiptoppay/refund/route.ts
// Refund-уведомление: приходит при возврате платежа (полном или частичном).
// В отличие от обычной отмены подписки на сайте (доступ до конца оплаченного
// периода), возврат закрывает доступ НЕМЕДЛЕННО: деньги вернулись — доступа нет.

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyWebhook,
  parseWebhookBody,
  cancelSubscription,
} from '@/lib/tiptoppay'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { isValidUserAccountId } from '@/lib/tiptoppay-product'
import { recordRefundedPayment } from '@/lib/ttp-refund-ledger'
import { logServerError } from '@/lib/safe-errors'
import { safeLog } from '@/lib/safe-logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SubRow = { id: string; tiptop_subscription_id: string | null }

async function resolveUserId(accountId: string): Promise<string | null> {
  if (isValidUserAccountId(accountId)) return accountId
  const phone = normalizePhoneToE164(accountId)
  if (!phone) return null
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle<{ id: string }>()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  const transactionId = p.TransactionId || null
  const originalTransactionId = p.OriginalTransactionId || null
  const accountId = p.AccountId?.trim() || null
  const amount = p.Amount || null

  // Возврат всегда подтверждаем code 0, иначе TipTop ретраит.
  if (!accountId) {
    logServerError('api/tiptoppay/refund', new Error('missing AccountId'))
    return NextResponse.json({ code: 0 })
  }

  try {
    const userId = await resolveUserId(accountId)
    const admin = createSupabaseAdminClient()

    if (userId) {
      const { data } = await admin
        .from('subscriptions')
        .select('id, tiptop_subscription_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<SubRow>()
      const subRow = data ?? null

      if (subRow) {
        const today = new Date().toISOString().slice(0, 10)
        const { error } = await admin
          .from('subscriptions')
          .update({ status: 'inactive', end_date: today })
          .eq('id', subRow.id)
        if (error) throw error

        if (subRow.tiptop_subscription_id) {
          try {
            await cancelSubscription(subRow.tiptop_subscription_id)
          } catch (cancelError) {
            logServerError('api/tiptoppay/refund:cancel', cancelError)
          }
        }
      }
    }

    try {
      await recordRefundedPayment({
        ttpAccountId: accountId,
        refundTransactionId: transactionId,
        originalTransactionId,
        rawPayload: p,
      })
    } catch (ledgerError) {
      logServerError('api/tiptoppay/refund:ledger', ledgerError)
    }

    safeLog.info('[api/tiptoppay/refund] processed', {
      accountId,
      userId,
      transactionId,
      originalTransactionId,
      amount,
    })
  } catch (error) {
    logServerError('api/tiptoppay/refund', error)
  }

  return NextResponse.json({ code: 0 })
}
