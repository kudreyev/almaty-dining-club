/**
 * Адаптер доставки доступа после оплаты.
 * WhatsApp (Utility-шаблон) → SMS fallback при failed / нет delivered за 60 сек.
 * Провайдер SMS переключается конфигом SMS_PROVIDER (twilio | stub).
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAccessUrl, PRICE_KZT } from '@/lib/pricing'
import { logServerError } from '@/lib/safe-errors'
import { safeLog } from '@/lib/safe-logger'

export type AccessMessagePayload = {
  phoneE164: string
  nextChargeDate: string
  /** Корреляция для status callback. */
  deliveryKey: string
}

type TwilioCredentials = {
  accountSid: string
  authToken: string
  whatsappFrom: string
  smsFrom: string
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
    smsFrom: bare,
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
  sendAccessSms(payload: AccessMessagePayload): Promise<void>
}

function buildAccessSmsBody(payload: AccessMessagePayload): string {
  const access = getAccessUrl()
  return `Оплата прошла! Ваш доступ: ${access}. Следующее списание — ${payload.nextChargeDate}. Отмена в кабинете в 2 клика. (${PRICE_KZT} ₸/мес)`
}

class TwilioAccessMessaging implements AccessMessagingAdapter {
  async sendAccessGranted(payload: AccessMessagePayload): Promise<void> {
    const creds = getTwilioCredentials()
    if (!creds) throw new Error('Twilio credentials are not set')

    const contentSid = process.env.TWILIO_CONTENT_SID_ACCESS?.trim()
    const callback = statusCallbackUrl()

    if (contentSid) {
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
        channel: 'whatsapp',
        messageSid: result.sid,
        nextChargeDate: payload.nextChargeDate,
      })
      scheduleSmsFallback(payload)
      return
    }

    // Шаблон ещё не одобрен — сразу SMS.
    safeLog.info('[access-messaging] TWILIO_CONTENT_SID_ACCESS missing, SMS only')
    await this.sendAccessSms(payload)
  }

  async sendAccessSms(payload: AccessMessagePayload): Promise<void> {
    const provider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase()
    if (provider !== 'twilio') {
      safeLog.info('[access-messaging] SMS provider stub', {
        provider,
        phone: payload.phoneE164,
      })
      return
    }

    const creds = getTwilioCredentials()
    if (!creds) throw new Error('Twilio credentials are not set')

    const result = await twilioCreateMessage(creds, {
      From: creds.smsFrom,
      To: payload.phoneE164,
      Body: buildAccessSmsBody(payload),
    })
    await rememberDelivery({
      deliveryKey: payload.deliveryKey,
      phone: payload.phoneE164,
      channel: 'sms',
      messageSid: result.sid,
      nextChargeDate: payload.nextChargeDate,
    })
  }
}

/** In-memory трекинг доставки (достаточно на один инстанс + callback). */
type DeliveryState = {
  phone: string
  channel: 'whatsapp' | 'sms'
  messageSid: string
  nextChargeDate: string
  delivered: boolean
  failed: boolean
  smsSent: boolean
  createdAt: number
}

const deliveries = new Map<string, DeliveryState>()

async function rememberDelivery(args: {
  deliveryKey: string
  phone: string
  channel: 'whatsapp' | 'sms'
  messageSid: string
  nextChargeDate: string
}): Promise<void> {
  const prev = deliveries.get(args.deliveryKey)
  deliveries.set(args.deliveryKey, {
    phone: args.phone,
    channel: args.channel,
    messageSid: args.messageSid,
    nextChargeDate: args.nextChargeDate,
    delivered: false,
    failed: false,
    smsSent: args.channel === 'sms' || Boolean(prev?.smsSent),
    createdAt: prev?.createdAt ?? Date.now(),
  })

  // Опционально пишем в analytics_events для отладки (не критично).
  try {
    const db = createSupabaseAdminClient()
    await db.from('analytics_events').insert({
      event_name: 'access_message_sent',
      meta: {
        delivery_key: args.deliveryKey,
        channel: args.channel,
        message_sid: args.messageSid,
        phone: args.phone,
      },
    })
  } catch {
    // таблица/колонки могут отличаться — не роняем доставку
  }
}

function scheduleSmsFallback(payload: AccessMessagePayload): void {
  setTimeout(() => {
    void (async () => {
      const state = deliveries.get(payload.deliveryKey)
      if (!state || state.delivered || state.smsSent) return
      try {
        await getAccessMessaging().sendAccessSms(payload)
        state.smsSent = true
      } catch (error) {
        logServerError('access-messaging:sms-fallback-60s', error)
      }
    })()
  }, 60_000)
}

/** Обработка Twilio StatusCallback. */
export async function handleTwilioMessageStatus(args: {
  messageSid: string
  messageStatus: string
}): Promise<void> {
  const status = args.messageStatus.toLowerCase()
  let matched: { key: string; state: DeliveryState } | null = null
  for (const [key, state] of deliveries.entries()) {
    if (state.messageSid === args.messageSid) {
      matched = { key, state }
      break
    }
  }
  if (!matched) return

  if (status === 'delivered' || status === 'read') {
    matched.state.delivered = true
    return
  }

  if (
    status === 'failed' ||
    status === 'undelivered' ||
    status === 'canceled'
  ) {
    matched.state.failed = true
    if (matched.state.channel === 'whatsapp' && !matched.state.smsSent) {
      try {
        await getAccessMessaging().sendAccessSms({
          phoneE164: matched.state.phone,
          nextChargeDate: matched.state.nextChargeDate,
          deliveryKey: matched.key,
        })
        matched.state.smsSent = true
      } catch (error) {
        logServerError('access-messaging:sms-on-failed', error)
      }
    }
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
    try {
      await getAccessMessaging().sendAccessSms({
        phoneE164: args.phoneE164,
        nextChargeDate,
        deliveryKey: `${args.transactionId}_sms`,
      })
    } catch (smsError) {
      logServerError('access-messaging:sms-emergency', smsError)
    }
  }
}
