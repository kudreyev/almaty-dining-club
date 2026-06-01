'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { completeActivation, getActivationLinkByToken } from '@/lib/activation-links'
import { logAnalyticsEvent } from '@/lib/analytics'

export type ActivateActionResult =
  | { ok: true; purchaseEventId: string; trialEventId: string; kind: 'paid' | 'trial' }
  | {
      ok: false
      reason:
        | 'login_required'
        | 'invalid'
        | 'revoked'
        | 'expired'
        | 'already_used'
        | 'wrong_phone'
        | 'subscription_error'
        | 'trial_already_used'
        | 'not_customer'
    }

export async function activateAction(
  rawToken: string
): Promise<ActivateActionResult> {
  const token = typeof rawToken === 'string' ? rawToken.trim() : ''
  if (!token) {
    return { ok: false, reason: 'invalid' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: 'login_required' }
  }

  // Re-fetch the row so analytics events have correct context regardless of
  // whether the page render computed it earlier.
  const row = await getActivationLinkByToken(token)

  const result = await completeActivation({ userId: user.id, token })

  if (result.ok) {
    await logAnalyticsEvent({
      event_name: 'activation_activated',
      activation_link_id: row?.id ?? null,
      token: row?.token ?? token,
      phone_target: row?.phone_target ?? null,
      user_id: user.id,
      meta: { kind: result.kind },
    })

    revalidatePath('/app/me')
    revalidatePath('/admin/activation-links')

    return {
      ok: true,
      purchaseEventId: result.purchaseEventId,
      trialEventId: result.trialEventId,
      kind: result.kind,
    }
  }

  if (result.reason === 'wrong_phone') {
    const userPhone =
      typeof user.user_metadata?.phone_e164 === 'string'
        ? user.user_metadata.phone_e164
        : null
    await logAnalyticsEvent({
      event_name: 'activation_phone_mismatch',
      activation_link_id: row?.id ?? null,
      token: row?.token ?? token,
      phone_target: row?.phone_target ?? null,
      user_id: user.id,
      meta: { userPhone },
    })
  }

  return { ok: false, reason: result.reason }
}
