const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/
type EmailOtpType = 'magiclink' | 'email'

type TwilioEnv = {
  accountSid: string
  authToken: string
  from: string
  contentSid: string
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function getTwilioEnv(): TwilioEnv {
  const phoneNumber = getRequiredEnv('TWILIO_PHONE_NUMBER')
  const from = phoneNumber.startsWith('whatsapp:')
    ? phoneNumber
    : `whatsapp:${phoneNumber}`

  return {
    accountSid: getRequiredEnv('TWILIO_ACCOUNT_SID'),
    authToken: getRequiredEnv('TWILIO_AUTH_TOKEN'),
    from,
    contentSid: getRequiredEnv('TWILIO_CONTENT_SID_VERIFICATION'),
  }
}

export function normalizePhoneToE164(rawPhone: string) {
  const digits = rawPhone.replace(/[^\d+]/g, '')

  let normalized = digits
  if (!normalized.startsWith('+')) {
    const plain = normalized.replace(/\D/g, '')

    if (plain.length === 10) {
      normalized = `+7${plain}`
    } else if (plain.length === 11 && plain.startsWith('8')) {
      normalized = `+7${plain.slice(1)}`
    } else if (plain.length === 11 && plain.startsWith('7')) {
      normalized = `+${plain}`
    } else {
      return null
    }
  } else {
    // User typed with '+'. Check for common KZ mistake: +7XXXXXXXXX (10 digits after +)
    // where they forgot the leading 7 of the subscriber number.
    // E.g. "+7080451111" (10 digits) → should be "+77080451111" (11 digits).
    const afterPlus = normalized.slice(1).replace(/\D/g, '')
    if (afterPlus.length === 10 && afterPlus.startsWith('7')) {
      // Treat as KZ number without the extra 7 prefix — prepend it.
      normalized = `+7${afterPlus}`
    }
  }

  if (!PHONE_E164_REGEX.test(normalized)) {
    return null
  }

  return normalized
}

function toSyntheticEmail(phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, '')
  return `wa_${digits}@wa.local`
}

function isEmailOtpType(value: string): value is EmailOtpType {
  return [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ].includes(value)
}

async function ensureAuthUserForPhone(phoneE164: string) {
  return toSyntheticEmail(phoneE164)
}

async function generateLoginOtp(email: string) {
  const tokenHash = `${email}-${Date.now()}`
  const verifyType: EmailOtpType = 'magiclink'

  return {
    tokenHash,
    verifyType,
  }
}

async function sendTwilioTemplateMessage({
  to,
  verificationCode,
}: {
  to: string
  verificationCode: string
}) {
  const { accountSid, authToken, from, contentSid } = getTwilioEnv()

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const body = new URLSearchParams()
  body.set('From', from)
  body.set('To', `whatsapp:${to}`)
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

export async function createWhatsAppLoginChallenge(rawPhone: string) {
  const phoneE164 = normalizePhoneToE164(rawPhone)
  if (!phoneE164) {
    throw new Error('Некорректный номер телефона. Используйте формат +7XXXXXXXXXX.')
  }

  const email = await ensureAuthUserForPhone(phoneE164)
  const { tokenHash, verifyType } = await generateLoginOtp(email)

  return {
    email,
    phoneE164,
    tokenHash,
    verifyType,
  }
}

export async function sendWhatsAppVerificationCode({
  phoneE164,
  verificationCode,
}: {
  phoneE164: string
  verificationCode: string
}) {
  await sendTwilioTemplateMessage({
    to: phoneE164,
    verificationCode,
  })
}
