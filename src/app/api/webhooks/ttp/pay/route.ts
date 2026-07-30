// Pay: успешное списание → product subscriptions + analytics ledger.
// URL для ЛК TipTop Pay: https://kudaclub.kz/api/webhooks/ttp/pay

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { logServerError } from '@/lib/safe-errors'
import { fulfillSuccessfulPay } from '@/lib/checkout/fulfill-pay'
import { webhookOk, webhookReject } from '@/lib/ttp-webhook-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json(webhookReject(), { status: 401 })
  }

  const p = parseWebhookBody(rawBody)

  try {
    await fulfillSuccessfulPay(p)
  } catch (error) {
    logServerError('webhooks/ttp/pay', error)
    return NextResponse.json(webhookReject(), { status: 500 })
  }

  return NextResponse.json(webhookOk())
}
