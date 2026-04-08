import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const STAFF_SESSION_COOKIE = 'staff_session'

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

export function hashStaffSessionToken(raw: string) {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export async function establishStaffBrowserSession(restaurantId: string) {
  const raw = randomBytes(32).toString('base64url')
  const session_token_hash = hashStaffSessionToken(raw)
  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_MAX_AGE_SEC)

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('staff_sessions').insert({
    restaurant_id: restaurantId,
    session_token_hash,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    return { ok: false as const, message: 'Не удалось создать сессию. Попробуйте снова.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(STAFF_SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })

  return { ok: true as const }
}

export async function clearStaffSession() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(STAFF_SESSION_COOKIE)?.value
  cookieStore.delete(STAFF_SESSION_COOKIE)

  if (raw) {
    const admin = createSupabaseAdminClient()
    await admin
      .from('staff_sessions')
      .delete()
      .eq('session_token_hash', hashStaffSessionToken(raw))
  }
}

export async function getStaffSessionRestaurantId() {
  const cookieStore = await cookies()
  const raw = cookieStore.get(STAFF_SESSION_COOKIE)?.value
  if (!raw) {
    return null
  }

  const admin = createSupabaseAdminClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('staff_sessions')
    .select('restaurant_id')
    .eq('session_token_hash', hashStaffSessionToken(raw))
    .gt('expires_at', nowIso)
    .maybeSingle<{ restaurant_id: string }>()

  if (error || !data) {
    return null
  }

  return data.restaurant_id
}
