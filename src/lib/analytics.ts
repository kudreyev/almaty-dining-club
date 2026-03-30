import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
  token?: string | null
  phone_target?: string | null
  user_id?: string | null
  meta?: Record<string, unknown> | null
}) {
  try {
    const admin = createSupabaseAdminClient()
    await admin.from('analytics_events').insert({
      event_name: args.event_name,
      activation_link_id: args.activation_link_id ?? null,
      token: args.token ?? null,
      phone_target: args.phone_target ?? null,
      user_id: args.user_id ?? null,
      meta: args.meta ?? null,
    })
  } catch {
    // Best-effort: analytics must never break UX.
  }
}

