/**
 * Доставка доступа после оплаты через WhatsApp Utility-шаблон.
 * SMS-fallback временно отключён (нет Twilio SMS) — вернём позже через адаптер.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAccessUrl } from '@/lib/pricing'
import { logServerError } from '@/lib/safe-errors'
import { safeLog } from '@/lib/safe-logger'

export type AccessMessagePayload = {
  phoneE164: string
  nextChargeDate: string
  /** Корреляция для status callback / логов. */
  deliveryKey: string
}

type TwilioCredentials = {
  accountSid: string
  authToken: string
  whatsappFrom: string
}

function getTwilioCredentials(): TwilioCredentials | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !phoneNumber) return null

  const bare = phoneNumber.replace(/^whatsapp:/, '')
  return {
    accountSid,
    authToken,
    whatsappFrom: phoneNumber.startsWith('whatsapp:')
      ? phoneNumber
      : `whatsapp:${bare}`,
  }
}

function statusCallbackUrl(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) return null
  return `${site.replace(/\/$/, '')}/api/webhooks/twilio/message-status`
}

async function twilioCreateMessage(
  creds: TwilioCredentials,
  params: Record<string, string>,
): Promise<{ sid: string; status: string }> {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString(
    'base64',
  )
  const body = new URLSearchParams(params)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`Twilio API error (${response.status}): ${raw}`)
  }
  const json = JSON.parse(raw) as { sid?: string; status?: string }
  return { sid: json.sid ?? '', status: json.status ?? 'queued' }
}

export interface AccessMessagingAdapter {
  sendAccessGranted(payload: AccessMessagePayload): Promise<void>
}

class TwilioAccessMessaging implements AccessMessagingAdapter {
  async sendAccessGranted(payload: AccessMessagePayload): Promise<void> {
    const creds = getTwilioCredentials()
    if (!creds) throw new Error('Twilio credentials are not set')

    const contentSid = process.env.TWILIO_CONTENT_SID_ACCESS?.trim()
    if (!contentSid) {
      safeLog.info(
        '[access-messaging] TWILIO_CONTENT_SID_ACCESS missing — skip WhatsApp',
      )
      return
    }

    const callback = statusCallbackUrl()
    const params: Record<string, string> = {
      From: creds.whatsappFrom,
      To: `whatsapp:${payload.phoneE164}`,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify({
        '1': getAccessUrl(),
        '2': payload.nextChargeDate,
      }),
    }
    if (callback) {
      params.StatusCallback = callback
      params.StatusCallbackMethod = 'POST'
    }

    const result = await twilioCreateMessage(creds, params)
    await rememberDelivery({
      deliveryKey: payload.deliveryKey,
      phone: payload.phoneE164,
      messageSid: result.sid,
    })
  }
}

type DeliveryState = {
  phone: string
  messageSid: string
  delivered: boolean
  failed: boolean
}

const deliveries = new Map<string, DeliveryState>()

async function rememberDelivery(args: {
  deliveryKey: string
  phone: string
  messageSid: string
}): Promise<void> {
  deliveries.set(args.deliveryKey, {
    phone: args.phone,
    messageSid: args.messageSid,
    delivered: false,
    failed: false,
  })

  try {
    const db = createSupabaseAdminClient()
    await db.from('analytics_events').insert({
      event_name: 'access_message_sent',
      meta: {
        delivery_key: args.deliveryKey,
        channel: 'whatsapp',
        message_sid: args.messageSid,
        phone: args.phone,
      },
    })
  } catch {
    // не роняем доставку из‑за аналитики
  }
}

/** StatusCallback Twilio — только учёт статуса, без SMS-fallback. */
export async function handleTwilioMessageStatus(args: {
  messageSid: string
  messageStatus: string
}): Promise<void> {
  const status = args.messageStatus.toLowerCase()
  for (const state of deliveries.values()) {
    if (state.messageSid !== args.messageSid) continue
    if (status === 'delivered' || status === 'read') {
      state.delivered = true
    } else if (
      status === 'failed' ||
      status === 'undelivered' ||
      status === 'canceled'
    ) {
      state.failed = true
      safeLog.warn('[access-messaging] WhatsApp delivery failed', {
        messageSid: args.messageSid,
        status,
        phone: state.phone,
      })
    }
    return
  }
}

let adapter: AccessMessagingAdapter | null = null

export function getAccessMessaging(): AccessMessagingAdapter {
  if (!adapter) adapter = new TwilioAccessMessaging()
  return adapter
}

/** Для тестов. */
export function setAccessMessagingForTests(
  next: AccessMessagingAdapter | null,
): void {
  adapter = next
}

export async function sendAccessAfterPayment(args: {
  phoneE164: string
  endDateIso: string
  transactionId: string
}): Promise<void> {
  const nextChargeDate = new Date(args.endDateIso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  try {
    await getAccessMessaging().sendAccessGranted({
      phoneE164: args.phoneE164,
      nextChargeDate,
      deliveryKey: args.transactionId,
    })
  } catch (error) {
    logServerError('access-messaging:send', error)
  }
}
