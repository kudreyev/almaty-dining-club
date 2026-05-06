const isProduction = process.env.NODE_ENV === 'production'

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'no-phone'
  if (phone.length < 8) return 'short-phone'
  return phone.slice(0, 5) + '****' + phone.slice(-3)
}

function maskUserId(userId: string | null | undefined): string {
  if (!userId) return 'no-user'
  return userId.slice(0, 8) + '...'
}

type SanitizeInput = Record<string, unknown> | undefined | null

function sanitize(data: SanitizeInput): SanitizeInput {
  if (!data || typeof data !== 'object') return data
  const cleaned = { ...data } as Record<string, unknown>

  if (typeof cleaned.phone === 'string') cleaned.phone = maskPhone(cleaned.phone)
  if (typeof cleaned.phoneE164 === 'string') cleaned.phoneE164 = maskPhone(cleaned.phoneE164)
  if (typeof cleaned.userPhone === 'string') cleaned.userPhone = maskPhone(cleaned.userPhone)
  if (typeof cleaned.user_id === 'string') cleaned.user_id = maskUserId(cleaned.user_id)
  if (typeof cleaned.userId === 'string') cleaned.userId = maskUserId(cleaned.userId)
  if (typeof cleaned.email === 'string') cleaned.email = '[redacted]'

  delete cleaned.user_metadata
  delete cleaned.metadata

  return cleaned
}

export const safeLog = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (isProduction) {
      console.log(message, sanitize(data))
    } else {
      console.log(message, data)
    }
  },

  warn: (message: string, data?: Record<string, unknown>) => {
    if (isProduction) {
      console.warn(message, sanitize(data))
    } else {
      console.warn(message, data)
    }
  },

  error: (message: string, err?: unknown) => {
    if (isProduction) {
      const detail = err instanceof Error ? err.message : 'unknown'
      console.error(message, detail)
    } else {
      console.error(message, err)
    }
  },

  logAuth: (
    event: string,
    payload: { userId?: string | null; phone?: string | null },
  ) => {
    console.log(`[auth] ${event}`, {
      userId: maskUserId(payload.userId ?? undefined),
      phone: maskPhone(payload.phone ?? undefined),
    })
  },
}
