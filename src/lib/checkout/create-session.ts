/**
 * Создание SSR-сессии по телефону без OTP (только после подтверждённого Pay).
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ensureProfilePhone } from '@/lib/profile-sync'
import {
  normalizePhoneToE164,
} from '@/lib/auth/whatsapp-login'
import type { EmailOtpType } from '@supabase/supabase-js'

function toSyntheticEmail(phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, '')
  return `wa_${digits}@wa.local`
}

function isEmailOtpType(value: string): value is EmailOtpType {
  return [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ].includes(value)
}

/**
 * Гарантирует auth-пользователя и возвращает userId.
 * Экспорт для Pay-вебхука (создание аккаунта после оплаты).
 */
export async function ensureUserIdForPhone(phoneE164: string): Promise<string> {
  const phone = normalizePhoneToE164(phoneE164)
  if (!phone) throw new Error('INVALID_PHONE')

  const email = toSyntheticEmail(phone)
  const admin = createSupabaseAdminClient()

  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      phone_e164: phone,
      auth_channel: 'whatsapp',
    },
  })

  if (!createError && createData.user?.id) {
    await ensureProfilePhone(createData.user.id, phone)
    return createData.user.id
  }

  const alreadyExists =
    createError?.message?.toLowerCase().includes('already') ?? false
  if (!alreadyExists) {
    throw new Error(
      `Failed to create auth user: ${createError?.message ?? 'unknown'}`,
    )
  }

  // Найти существующего по listUsers filter — через generateLink / getUserByEmail нет
  // стабильного API; используем magiclink properties или profiles.
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle<{ id: string }>()

  if (profile?.id) {
    return profile.id
  }

  // Fallback: generateLink вернёт user в data.user
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kudaclub.kz'
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/app/me` },
  })
  if (linkError) {
    throw new Error(`Failed to resolve user: ${linkError.message}`)
  }
  const userId =
    (linkData as { user?: { id?: string } } | null)?.user?.id ?? null
  if (!userId) {
    throw new Error('Failed to resolve existing auth user id')
  }
  await ensureProfilePhone(userId, phone)
  return userId
}

/** Выдаёт cookie-сессию Supabase для пользователя с этим телефоном. */
export async function createSessionForPhone(
  phoneE164: string,
): Promise<{ userId: string }> {
  const phone = normalizePhoneToE164(phoneE164)
  if (!phone) throw new Error('INVALID_PHONE')

  const userId = await ensureUserIdForPhone(phone)
  const email = toSyntheticEmail(phone)
  const admin = createSupabaseAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kudaclub.kz'

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/app/me` },
  })
  if (error) throw new Error(`generateLink failed: ${error.message}`)

  const actionLink: string | null =
    (data as { properties?: { action_link?: string } } | null)?.properties
      ?.action_link ?? null

  const tokenHashFromActionLink = (() => {
    if (!actionLink) return null
    try {
      const url = new URL(actionLink)
      return (
        url.searchParams.get('token_hash') ??
        url.searchParams.get('hashed_token') ??
        null
      )
    } catch {
      return null
    }
  })()

  const tokenHash =
    (data as { properties?: { hashed_token?: string; token_hash?: string } } | null)
      ?.properties?.hashed_token ??
    (data as { properties?: { hashed_token?: string; token_hash?: string } } | null)
      ?.properties?.token_hash ??
    tokenHashFromActionLink

  if (!tokenHash) {
    throw new Error('Supabase did not return token_hash for session')
  }

  const verificationTypeRaw =
    (data as { properties?: { verification_type?: string } } | null)?.properties
      ?.verification_type ??
    (data as { verification_type?: string } | null)?.verification_type
  const verifyType: EmailOtpType =
    verificationTypeRaw && isEmailOtpType(verificationTypeRaw)
      ? verificationTypeRaw
      : 'magiclink'

  const supabase = await createSupabaseServerClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: verifyType,
  })
  if (verifyError) {
    throw new Error(`verifyOtp failed: ${verifyError.message}`)
  }

  await ensureProfilePhone(userId, phone)
  return { userId }
}
