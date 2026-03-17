import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/

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

async function ensureAuthUserForPhone(phoneE164: string) {
  const supabaseAdmin = createSupabaseAdminClient()
  const email = toSyntheticEmail(phoneE164)

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      phone_e164: phoneE164,
      auth_channel: 'whatsapp',
    },
  })

  if (createError && !createError.message.toLowerCase().includes('already')) {
    throw new Error(`Failed to create auth user: ${createError.message}`)
  }

  return email
}

async function generateLoginLink(email: string) {
  const supabaseAdmin = createSupabaseAdminClient()
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/app/me`,
    },
  })

  if (error) {
    throw new Error(`Failed to generate magic link: ${error.message}`)
  }

  const actionLink = data?.properties?.action_link
  if (!actionLink) {
    throw new Error('Supabase did not return an action_link')
  }

  return actionLink
}

async function sendTwilioTemplateMessage({
  to,
  loginUrl,
}: {
  to: string
  loginUrl: string
}) {
  const { accountSid, authToken, from, contentSid } = getTwilioEnv()

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const body = new URLSearchParams()
  body.set('From', from)
  body.set('To', `whatsapp:${to}`)
  body.set('ContentSid', contentSid)
  body.set('ContentVariables', JSON.stringify({ '1': loginUrl }))

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

export async function sendWhatsAppLoginMessage(rawPhone: string) {
  const phoneE164 = normalizePhoneToE164(rawPhone)
  if (!phoneE164) {
    throw new Error('Некорректный номер телефона. Используйте формат +7XXXXXXXXXX.')
  }

  const email = await ensureAuthUserForPhone(phoneE164)
  const loginUrl = await generateLoginLink(email)
  await sendTwilioTemplateMessage({
    to: phoneE164,
    loginUrl,
  })
}
