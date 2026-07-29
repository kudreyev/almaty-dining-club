// Pay-уведомление: приходит после КАЖДОГО успешного платежа —
// и установочного (первая оплата через виджет), и каждого рекуррентного списания.
// Это единственный надёжный источник правды об оплате. Не активируйте подписку
// по коллбэку виджета на фронте — только здесь.
//
// Параллельный URL для ЛК TipTop: /api/webhooks/ttp/pay (тот же ledger + product).

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { logServerError } from '@/lib/safe-errors'
import {
  activateProductSubscription,
  isValidUserAccountId,
} from '@/lib/tiptoppay-product'
import { recordSuccessfulPayment } from '@/lib/ttp-analytics-ledger'
import { notifyLedgerPaymentResult } from '@/lib/notify-ledger-payment'
import {
  parseAmount,
  parseWebhookJsonData,
} from '@/lib/ttp-webhook-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  const accountId = p.AccountId
  const subscriptionId = p.SubscriptionId || null
  const invoiceId = p.InvoiceId || null
  const status = p.Status

  if (status && status !== 'Completed' && status !== 'Authorized') {
    return NextResponse.json({ code: 0 })
  }

  if (!isValidUserAccountId(accountId)) {
    logServerError('api/tiptoppay/pay', new Error(`invalid AccountId: ${accountId}`))
    return NextResponse.json({ code: 0 })
  }

  try {
    await activateProductSubscription({
      accountId: accountId!,
      subscriptionId,
      invoiceId,
    })

    const transactionId = p.TransactionId?.trim()
    if (transactionId) {
      try {
        const ledger = await recordSuccessfulPayment({
          ttpAccountId: accountId!,
          ttpTransactionId: transactionId,
          amount: parseAmount(p.Amount),
          email: p.Email || null,
          phone: p.Phone || null,
          jsonData: parseWebhookJsonData(p),
          rawPayload: p,
        })
        notifyLedgerPaymentResult(ledger, parseAmount(p.Amount))
      } catch (ledgerError) {
        logServerError('api/tiptoppay/pay:ledger', ledgerError)
      }
    }
  } catch (error) {
    logServerError('api/tiptoppay/pay', error)
    return NextResponse.json({ code: 13 }, { status: 500 })
  }

  return NextResponse.json({ code: 0 })
}
