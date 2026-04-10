import { env } from '@/common/config/env'

function getRequiredTwilioConfig() {
  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.TWILIO_PHONE_NUMBER ||
    !env.TWILIO_CONTENT_SID_VERIFICATION
  ) {
    throw new Error('Twilio WhatsApp env is incomplete')
  }

  return {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    from: env.TWILIO_PHONE_NUMBER.startsWith('whatsapp:')
      ? env.TWILIO_PHONE_NUMBER
      : `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
    contentSid: env.TWILIO_CONTENT_SID_VERIFICATION,
  }
}

export async function sendWhatsAppVerificationCode(phoneE164: string, verificationCode: string) {
  const { accountSid, authToken, from, contentSid } = getRequiredTwilioConfig()
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const body = new URLSearchParams()
  body.set('From', from)
  body.set('To', `whatsapp:${phoneE164}`)
  body.set('ContentSid', contentSid)
  body.set('ContentVariables', JSON.stringify({ '1': verificationCode }))

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const raw = await response.text()
    throw new Error(`Twilio API error (${response.status}): ${raw}`)
  }
}
