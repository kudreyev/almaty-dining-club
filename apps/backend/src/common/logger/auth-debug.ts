import { env } from '@/common/config/env'

type AuthDebugPayload = Record<string, unknown>

export function authDebug(event: string, payload: AuthDebugPayload = {}) {
  if (!env.AUTH_DEBUG) return

  console.info(
    JSON.stringify({
      scope: 'auth',
      event,
      at: new Date().toISOString(),
      ...payload,
    })
  )
}
