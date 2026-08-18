// Recurrent: product subscriptions + analytics ledger.
// URL: https://kudaclub.kz/api/webhooks/ttp/recurrent

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { logServerError } from '@/lib/safe-errors'
import { applyProductRecurrentStatus } from '@/lib/tiptoppay-product'
import { applyRecurrentStatus } from '@/lib/ttp-analytics-ledger'
import { notifySubscriberLost } from '@/lib/analytics-telegram'
import {
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
  const status = p.Status
  const accountId = p.AccountId?.trim() || null
  const reason = p.Reason || p.Status || null

  try {
    if (status) {
      await applyProductRecurrentStatus({
        accountId,
        subscriptionId: p.Id || null,
        status,
      })
    }

    const result = await applyRecurrentStatus({
      ttpAccountId: accountId,
      ttpSubscriptionId: p.Id || null,
      status: status || '',
      reason,
      jsonData: parseWebhookJsonData(p),
    })

    if (result.cancelled && result.changed) {
      void notifySubscriberLost({ reason, subscriber: result.subscriber })
    }
  } catch (error) {
    logServerError('webhooks/ttp/recurrent', error)
    return NextResponse.json(webhookReject(), { status: 500 })
  }

  return NextResponse.json(webhookOk())
}
