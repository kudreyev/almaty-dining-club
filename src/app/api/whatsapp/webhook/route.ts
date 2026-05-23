import { NextResponse } from 'next/server'
import {
  getWhatsAppVerifyToken,
  parseInboundWhatsAppMessages,
  verifyWhatsAppWebhookSignature,
} from '@/lib/whatsapp-cloud'
import { processInboundWhatsAppMessage } from '@/lib/whatsapp-inbound'
import { logServerError } from '@/lib/safe-errors'

/**
 * WhatsApp Cloud API webhook (Слой 5).
 * GET — verify Meta challenge. POST — входящие сообщения → copilot draft.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const verifyToken = getWhatsAppVerifyToken()
  if (mode === 'subscribe' && token && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()

  if (appSecret) {
    if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const messages = parseInboundWhatsAppMessages(body as Parameters<typeof parseInboundWhatsAppMessages>[0])
  const results: Array<{ wamid: string; ok: boolean; reason?: string }> = []

  for (const msg of messages) {
    try {
      const result = await processInboundWhatsAppMessage(msg)
      if (result.ok) {
        results.push({ wamid: msg.wamid, ok: true })
      } else {
        results.push({ wamid: msg.wamid, ok: false, reason: result.reason })
      }
    } catch (error) {
      logServerError('whatsapp/webhook:process', error)
      results.push({ wamid: msg.wamid, ok: false, reason: 'error' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
