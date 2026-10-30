import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { safeLog } from '@/lib/safe-logger'
import type { UtmAttribution } from '@/lib/utm'

export type ProfileAttribution = Pick<UtmAttribution, 'utm_source' | 'utm_campaign' | 'ref_code'>

function attributionFields(attribution?: ProfileAttribution | null) {
  if (!attribution) return {}
  return {
    utm_source: attribution.utm_source || null,
    utm_campaign: attribution.utm_campaign || null,
    ref_code: attribution.ref_code || null,
  }
}

/**
 * Safely writes phone into public.profiles without overwriting the existing role.
 *
 * WHY auth.users.phone IS ALWAYS NULL:
 * We use synthetic-email auth (wa_<digits>@wa.local + magic-link OTP via Supabase)
 * instead of Supabase's built-in Phone provider.  Because of this Supabase never
 * populates auth.users.phone, and DB triggers on that column are useless here.
 * The real phone is stored in auth.users.user_metadata.phone_e164 (written in
 * ensureAuthUserForPhone) and must be synced to public.profiles.phone manually.
 *
 * profiles.phone is the "phone verified" flag: it is written only after OTP,
 * and code issuance (issue_redeem_token) requires it.
 *
 * Errors are swallowed: a sync failure must never break the login flow.
 *
 * @returns firstVerification — phone was written for the first time (signup completed).
 */
export async function ensureProfilePhone(
  userId: string,
  phone: string | null | undefined,
  attribution?: ProfileAttribution | null,
): Promise<{ firstVerification: boolean }> {
  if (!userId || !phone) return { firstVerification: false }

  const admin = createSupabaseAdminClient()
  const attrs = attributionFields(attribution)

  safeLog.logAuth('ensureProfilePhone', { userId, phone })

  try {
    const { data: existing, error: selectError } = await admin
      .from('profiles')
      .select('phone, utm_source, utm_campaign, ref_code')
      .eq('id', userId)
      .maybeSingle<{
        phone: string | null
        utm_source: string | null
        utm_campaign: string | null
        ref_code: string | null
      }>()

    if (selectError) {
      safeLog.error('[ensureProfilePhone] select failed', selectError)
      const fallback = await admin
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .maybeSingle<{ phone: string | null }>()
      if (fallback.data) {
        const { error: updateError } = await admin
          .from('profiles')
          .update({ phone })
          .eq('id', userId)
        if (updateError) {
          safeLog.error('[ensureProfilePhone] fallback update failed', updateError)
          return { firstVerification: false }
        }
        return { firstVerification: !fallback.data.phone }
      }
    }

    if (!existing) {
      const { error: insertError } = await admin
        .from('profiles')
        .insert({ id: userId, phone, role: 'user', ...attrs })

      if (!insertError) {
        safeLog.info('[ensureProfilePhone] inserted new profile')
        return { firstVerification: true }
      }

      safeLog.info('[ensureProfilePhone] insert conflict, updating existing profile', {
        insertCode: insertError.code,
        insertMessage: insertError.message,
      })
    } else if (existing.phone === phone) {
      return { firstVerification: false }
    }

    const firstVerification = !existing?.phone
    const updatePayload: Record<string, string | null> = { phone }
    if (firstVerification) {
      if (!existing?.utm_source && attrs.utm_source) updatePayload.utm_source = attrs.utm_source
      if (!existing?.utm_campaign && attrs.utm_campaign) {
        updatePayload.utm_campaign = attrs.utm_campaign
      }
      if (!existing?.ref_code && attrs.ref_code) updatePayload.ref_code = attrs.ref_code
    }

    // Existing-user path: only update phone (and first-touch attribution), preserving role.
    const { error: updateError } = await admin
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)

    if (updateError) {
      safeLog.error('[ensureProfilePhone] update failed', updateError)
      const retry = await admin.from('profiles').update({ phone }).eq('id', userId)
      if (retry.error) return { firstVerification: false }
      return { firstVerification: !existing?.phone }
    }

    safeLog.info('[ensureProfilePhone] updated phone for existing profile')
    return { firstVerification: !existing?.phone }
  } catch (err) {
    safeLog.error('[ensureProfilePhone] unexpected error', err)
    return { firstVerification: false }
  }
}
