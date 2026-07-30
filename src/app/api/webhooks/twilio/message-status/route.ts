// Twilio Message StatusCallback → SMS fallback при failed WhatsApp.

import { NextRequest, NextResponse } from 'next/server'
import { handleTwilioMessageStatus } from '@/lib/messaging/access-messaging'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const params = new URLSearchParams(raw)
    const messageSid = params.get('MessageSid') || params.get('SmsSid') || ''
    const messageStatus =
      params.get('MessageStatus') || params.get('SmsStatus') || ''

    if (messageSid && messageStatus) {
      await handleTwilioMessageStatus({ messageSid, messageStatus })
    }
  } catch (error) {
    logServerError('webhooks/twilio/message-status', error)
  }

  // Twilio ожидает 2xx
  return new NextResponse('ok', { status: 200 })
}
