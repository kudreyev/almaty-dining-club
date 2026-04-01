import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
 * Strategy:
 *  - Try INSERT (new user path) → sets id, phone, role='user'.
 *  - On conflict (existing user) → UPDATE phone only, role is untouched.
 *
 * Errors are swallowed: a sync failure must never break the login flow.
 */
export async function ensureProfilePhone(
  userId: string,
  phone: string | null | undefined,
): Promise<void> {
  if (!userId || !phone) return

  const admin = createSupabaseAdminClient()

  try {
    // New-user path: insert full row with default role.
    const { error: insertError } = await admin
      .from('profiles')
      .insert({ id: userId, phone, role: 'user' })

    if (!insertError) return

    // Existing-user path: only update phone, preserving role and all other fields.
    const { error: updateError } = await admin
      .from('profiles')
      .update({ phone })
      .eq('id', userId)

    if (updateError) {
      console.error('[ensureProfilePhone] update failed:', updateError.message)
    }
  } catch (err) {
    console.error('[ensureProfilePhone] unexpected error:', err)
  }
}
