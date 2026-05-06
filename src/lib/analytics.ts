import { createHash } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/** SHA-256 prefix for correlating events without storing activation secrets. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
}

export type AnalyticsEventName =
  | 'activation_link_created'
  | 'activation_opened'
  | 'activation_login_required'
  | 'activation_phone_mismatch'
  | 'activation_activated'
  | 'activation_already_activated'
  | 'activation_expired'
  | 'activation_not_found'

export async function logAnalyticsEvent(args: {
  event_name: AnalyticsEventName
  activation_link_id?: string | null
  /** Raw activation token — хешируется в БД; сырое значение не сохраняется. */
  token?: string | null
  phone_target?: string | null
  user_id?: string | null
  meta?: Record<string, unknown> | null
}) {
  try {
    const admin = createSupabaseAdminClient()
    const raw =
      typeof args.token === 'string' && args.token.trim() ? args.token.trim() : null
    const token_hash = raw ? hashToken(raw) : null

    await admin.from('analytics_events').insert({
      event_name: args.event_name,
      activation_link_id: args.activation_link_id ?? null,
      token_hash,
      phone_target: args.phone_target ?? null,
      user_id: args.user_id ?? null,
      meta: args.meta ?? null,
    })
  } catch {
    // Best-effort: analytics must never break UX.
  }
}

