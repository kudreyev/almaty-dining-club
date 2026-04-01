import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { EmailOtpType } from '@supabase/supabase-js'

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
  const supabaseAdmin = createSupabaseAdminClient()
  const email = toSyntheticEmail(phoneE164)

  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      phone_e164: phoneE164,
      auth_channel: 'whatsapp',
    },
  })

  if (!createError) {
    console.log('[whatsapp-login] new auth user created:', createData.user?.id, phoneE164)
    return email
  }

  const alreadyExists = createError.message.toLowerCase().includes('already')
  if (!alreadyExists) {
    throw new Error(`Failed to create auth user: ${createError.message}`)
  }

  // User already exists — that's fine. Phone will be saved to profiles
  // via the phoneE164 cookie set in setWhatsAppChallengeCookies.
  console.log('[whatsapp-login] user already exists for phone:', phoneE164)
  return email
}

async function generateLoginOtp(email: string) {
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

  const actionLink: string | null =
    (data as { properties?: { action_link?: string } } | null)?.properties
      ?.action_link ?? null

  const tokenHashFromActionLink = (() => {
    if (!actionLink) return null
    try {
      const url = new URL(actionLink)
      return (
        url.searchParams.get('token_hash') ??
        url.searchParams.get('hashed_token') ??
        null
      )
    } catch {
      return null
    }
  })()

  const tokenHash =
    (data as { properties?: { hashed_token?: string; token_hash?: string } } | null)
      ?.properties?.hashed_token ??
    (data as { properties?: { hashed_token?: string; token_hash?: string } } | null)
      ?.properties?.token_hash ??
    (data as { hashed_token?: string; token_hash?: string } | null)?.hashed_token ??
    (data as { hashed_token?: string; token_hash?: string } | null)?.token_hash ??
    tokenHashFromActionLink ??
    null
  if (!tokenHash) {
    const topLevelKeys =
      data && typeof data === 'object' ? Object.keys(data as object).sort() : []
    const propertiesKeys =
      data &&
      typeof data === 'object' &&
      'properties' in (data as object) &&
      (data as { properties?: unknown }).properties &&
      typeof (data as { properties?: unknown }).properties === 'object'
        ? Object.keys((data as { properties: object }).properties).sort()
        : []

    throw new Error(
      `Supabase did not return a token hash (data keys: [${topLevelKeys.join(
        ', '
      )}], properties keys: [${propertiesKeys.join(', ')}])`
    )
  }

  const verificationTypeRaw =
    (data as { properties?: { verification_type?: string } } | null)?.properties
      ?.verification_type ??
    (data as { verification_type?: string } | null)?.verification_type
  const verifyType: EmailOtpType =
    verificationTypeRaw && isEmailOtpType(verificationTypeRaw)
      ? verificationTypeRaw
      : 'magiclink'

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
