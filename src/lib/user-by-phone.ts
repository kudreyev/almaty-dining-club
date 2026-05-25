import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'

function toSyntheticEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  return `wa_${digits}@wa.local`
}

/** Нормализует wa_id из Meta (7706...) в E.164 (+7706...). */
export function waIdToE164(waId: string): string | null {
  const digits = waId.replace(/\D/g, '')
  if (!digits) return null
  return normalizePhoneToE164(digits.startsWith('+') ? digits : digits)
}

export type UserByPhoneResult = {
  userId: string
  profileId: string | null
  phoneE164: string
  isRegistered: boolean
}

/** Ищет пользователя по телефону: profiles.phone → auth synthetic email. */
export async function findUserByPhone(phoneE164: string): Promise<UserByPhoneResult | null> {
  const admin = createSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('phone', phoneE164)
    .maybeSingle()

  if (profile) {
    return {
      userId: profile.id,
      profileId: profile.id,
      phoneE164,
      isRegistered: true,
    }
  }

  const email = toSyntheticEmail(phoneE164)
  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return null

  const match = users.users.find((u) => {
    if (u.email === email) return true
    if (u.user_metadata?.phone_e164 === phoneE164) return true
    if (u.phone === phoneE164) return true
    return false
  })

  if (!match) return null

  return {
    userId: match.id,
    profileId: match.id,
    phoneE164,
    isRegistered: true,
  }
}

export async function resolveUserFromWaId(waId: string): Promise<{
  phoneE164: string | null
  user: UserByPhoneResult | null
}> {
  const phoneE164 = waIdToE164(waId)
  if (!phoneE164) return { phoneE164: null, user: null }
  const user = await findUserByPhone(phoneE164)
  return { phoneE164, user }
}
