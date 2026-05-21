import crypto from 'node:crypto'
import { safeLog } from '@/lib/safe-logger'
import {
  META_PURCHASE_CURRENCY,
  META_PURCHASE_VALUE_KZT,
  buildPurchaseEventId,
} from '@/lib/meta-purchase'

const PIXEL_ID = process.env.META_PIXEL_ID?.trim()
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN?.trim()

function hashPII(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export type SendPurchaseEventParams = {
  userId: string
  phone: string
  value?: number
  currency?: string
  eventId?: string
  eventTime?: number
  fbp?: string
  fbc?: string
}

export async function sendPurchaseEvent(params: SendPurchaseEventParams) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    safeLog.warn('[Meta CAPI] Not configured (META_PIXEL_ID / META_CAPI_ACCESS_TOKEN)')
    return
  }

  const eventTime = params.eventTime ?? Math.floor(Date.now() / 1000)
  const eventId =
    params.eventId ?? buildPurchaseEventId(params.userId, eventTime)

  const userData: Record<string, string | string[]> = {
    ph: [hashPII(params.phone)],
    external_id: [hashPII(params.userId)],
  }
  if (params.fbp) userData.fbp = params.fbp
  if (params.fbc) userData.fbc = params.fbc

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: eventTime,
        event_id: eventId,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: params.currency ?? META_PURCHASE_CURRENCY,
          value: params.value ?? META_PURCHASE_VALUE_KZT,
        },
      },
    ],
    access_token: ACCESS_TOKEN,
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )

    const result = (await response.json()) as {
      events_received?: number
      messages?: unknown[]
    }

    safeLog.info('[Meta CAPI] Purchase sent', {
      eventId,
      success: response.ok,
      events_received: result.events_received,
    })

    if (!response.ok) {
      safeLog.error('[Meta CAPI] API error', { status: response.status, result })
    }

    return result
  } catch (error) {
    safeLog.error('[Meta CAPI] Failed', { error })
  }
}
