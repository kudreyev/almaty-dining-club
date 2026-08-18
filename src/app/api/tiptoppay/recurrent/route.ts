// Recurrent-уведомление: приходит при изменении статуса подписки.
// Статусы: Active, PastDue, Cancelled, Rejected, Expired.
// Параллельный URL: /api/webhooks/ttp/recurrent

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { logServerError } from '@/lib/safe-errors'
import { applyProductRecurrentStatus } from '@/lib/tiptoppay-product'
import { applyRecurrentStatus } from '@/lib/ttp-analytics-ledger'
import { notifySubscriberLost } from '@/lib/analytics-telegram'
import { parseWebhookJsonData } from '@/lib/ttp-webhook-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)
  const status = p.Status
  const accountId = p.AccountId || null
  const subscriptionId = p.Id || null

  try {
    if (status) {
      await applyProductRecurrentStatus({
        accountId,
        subscriptionId,
        status,
      })
    }

    if (accountId && status) {
      try {
        const ledger = await applyRecurrentStatus({
          ttpAccountId: accountId,
          ttpSubscriptionId: subscriptionId,
          status,
          reason: p.Reason || status,
          jsonData: parseWebhookJsonData(p),
        })
        if (ledger.cancelled && ledger.changed) {
          void notifySubscriberLost({
            reason: p.Reason || status,
            subscriber: ledger.subscriber,
          })
        }
      } catch (ledgerError) {
        logServerError('api/tiptoppay/recurrent:ledger', ledgerError)
      }
    }
  } catch (error) {
    logServerError('api/tiptoppay/recurrent', error)
    return NextResponse.json({ code: 13 }, { status: 500 })
  }

  return NextResponse.json({ code: 0 })
}
