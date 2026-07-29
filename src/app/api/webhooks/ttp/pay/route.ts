// Pay: успешное списание → product subscriptions + analytics ledger.
// URL для ЛК TipTop Pay: https://kudaclub.kz/api/webhooks/ttp/pay

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
  webhookOk,
  webhookReject,
} from '@/lib/ttp-webhook-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json(webhookReject(), { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  const accountId = p.AccountId?.trim()
  const transactionId = p.TransactionId?.trim()
  const status = p.Status

  if (status && status !== 'Completed' && status !== 'Authorized') {
    return NextResponse.json(webhookOk())
  }

  if (!accountId || !transactionId) {
    logServerError(
      'webhooks/ttp/pay',
      new Error(`missing AccountId/TransactionId: ${accountId}/${transactionId}`),
    )
    return NextResponse.json(webhookOk())
  }

  try {
    // Продуктовый доступ (если AccountId — UUID пользователя).
    if (isValidUserAccountId(accountId)) {
      await activateProductSubscription({
        accountId,
        subscriptionId: p.SubscriptionId || null,
        invoiceId: p.InvoiceId || null,
      })
    }

    const result = await recordSuccessfulPayment({
      ttpAccountId: accountId,
      ttpTransactionId: transactionId,
      amount: parseAmount(p.Amount),
      email: p.Email || null,
      phone: p.Phone || null,
      jsonData: parseWebhookJsonData(p),
      rawPayload: p,
    })

    notifyLedgerPaymentResult(result, parseAmount(p.Amount))
  } catch (error) {
    logServerError('webhooks/ttp/pay', error)
    return NextResponse.json(webhookReject(), { status: 500 })
  }

  return NextResponse.json(webhookOk())
}
