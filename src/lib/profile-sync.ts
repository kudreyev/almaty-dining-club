import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { safeLog } from '@/lib/safe-logger'

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
): Promise<{ firstVerification: boolean }> {
  if (!userId || !phone) return { firstVerification: false }

  const admin = createSupabaseAdminClient()

  safeLog.logAuth('ensureProfilePhone', { userId, phone })

  try {
    const { data: existing, error: selectError } = await admin
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .maybeSingle<{ phone: string | null }>()

    if (selectError) {
      safeLog.error('[ensureProfilePhone] select failed', selectError)
    }

    if (!existing) {
      const { error: insertError } = await admin
        .from('profiles')
        .insert({ id: userId, phone, role: 'user' })

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

    // Existing-user path: only update phone, preserving role and all other fields.
    const { error: updateError } = await admin
      .from('profiles')
      .update({ phone })
      .eq('id', userId)

    if (updateError) {
      safeLog.error('[ensureProfilePhone] update failed', updateError)
      return { firstVerification: false }
    }

    safeLog.info('[ensureProfilePhone] updated phone for existing profile')
    return { firstVerification: !existing?.phone }
  } catch (err) {
    safeLog.error('[ensureProfilePhone] unexpected error', err)
    return { firstVerification: false }
  }
}
