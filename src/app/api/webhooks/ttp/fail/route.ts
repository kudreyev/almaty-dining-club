// Fail: неуспешное списание → payment(status=fail).
// URL: https://kudaclub.kz/api/webhooks/ttp/fail

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { logServerError } from '@/lib/safe-errors'
import { recordFailedPayment } from '@/lib/ttp-analytics-ledger'
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
  // TipTop/CloudPayments Fail: TransactionId; fallback на InvoiceId+Amount+DateTime.
  const transactionId =
    p.TransactionId?.trim() ||
    (p.InvoiceId
      ? `fail_${p.InvoiceId}_${p.DateTime ?? p.PaymentDateTime ?? 'unknown'}`
      : null)

  if (!accountId || !transactionId) {
    logServerError(
      'webhooks/ttp/fail',
      new Error(`missing AccountId/TransactionId: ${accountId}/${transactionId}`),
    )
    return NextResponse.json(webhookOk())
  }

  try {
    await recordFailedPayment({
      ttpAccountId: accountId,
      ttpTransactionId: transactionId,
      amount: parseAmount(p.Amount),
      email: p.Email || null,
      phone: p.Phone || null,
      jsonData: parseWebhookJsonData(p),
      rawPayload: p,
    })
  } catch (error) {
    logServerError('webhooks/ttp/fail', error)
    return NextResponse.json(webhookReject(), { status: 500 })
  }

  return NextResponse.json(webhookOk())
}
