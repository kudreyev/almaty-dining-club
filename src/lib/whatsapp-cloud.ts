import crypto from 'node:crypto'
import { logServerError } from '@/lib/safe-errors'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

function getAccessToken(): string | null {
  return process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() || null
}

function getPhoneNumberId(): string | null {
  return process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null
}

export function getWhatsAppVerifyToken(): string | null {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || null
}

/** Проверка подписи Meta webhook (X-Hub-Signature-256). */
export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!secret || !signatureHeader) return false

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  } catch {
    return false
  }
}

export type InboundWhatsAppMessage = {
  wamid: string
  waId: string
  text: string
  timestamp: string
  raw: unknown
}

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string
          from?: string
          timestamp?: string
          type?: string
          text?: { body?: string }
        }>
      }
    }>
  }>
}

/** Извлекает текстовые входящие сообщения из payload Meta. */
export function parseInboundWhatsAppMessages(body: WebhookPayload): InboundWhatsAppMessage[] {
  const out: InboundWhatsAppMessage[] = []

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type !== 'text' || !msg.id || !msg.from) continue
        const text = msg.text?.body?.trim()
        if (!text) continue
        out.push({
          wamid: msg.id,
          waId: msg.from,
          text,
          timestamp: msg.timestamp ?? String(Date.now()),
          raw: msg,
        })
      }
    }
  }

  return out
}

export async function sendWhatsAppText(args: {
  toWaId: string
  text: string
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const token = getAccessToken()
  const phoneNumberId = getPhoneNumberId()
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp Cloud API not configured' }
  }

  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: args.toWaId,
        type: 'text',
        text: { body: args.text },
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      logServerError('whatsapp-cloud:send', new Error(`${res.status}: ${detail}`))
      return { ok: false, error: detail }
    }

    const body = (await res.json()) as {
      messages?: Array<{ id?: string }>
    }
    return { ok: true, messageId: body.messages?.[0]?.id }
  } catch (error) {
    logServerError('whatsapp-cloud:send', error)
    return { ok: false, error: 'network_error' }
  }
}

export function isWhatsAppCloudConfigured(): boolean {
  return Boolean(getAccessToken() && getPhoneNumberId())
}

/** Исходящие через Cloud API. По умолчанию выкл — фаза 1: только черновики, ответ с телефона. */
export function isWhatsAppOutboundEnabled(): boolean {
  return process.env.WHATSAPP_OUTBOUND_ENABLED === 'true' && isWhatsAppCloudConfigured()
}
