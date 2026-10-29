import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Серверные события. code_requested пишет SQL-функция issue_redeem_token
 * (meta: restaurant_id, offer_id, token_id).
 */
export type AnalyticsEventName = 'signup_completed' | 'code_redeemed'

export async function logAnalyticsEvent(args: {
  event_name: AnalyticsEventName
  user_id?: string | null
  meta?: Record<string, unknown> | null
}) {
  try {
    const admin = createSupabaseAdminClient()
    await admin.from('analytics_events').insert({
      event_name: args.event_name,
      user_id: args.user_id ?? null,
      meta: args.meta ?? null,
    })
  } catch {
    // Best-effort: analytics must never break UX.
  }
}
