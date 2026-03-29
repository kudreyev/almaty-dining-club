import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'

export type ActivationLinkStatus = 'issued' | 'activated' | 'revoked' | 'expired'

export type ActivationLinkRow = {
  id: string
  token: string
  phone_target: string
  status: ActivationLinkStatus
  amount: number
  currency: string
  activated_user_id: string | null
  activated_at: string | null
  created_at: string
  expires_at: string
}

export function getPublicSiteBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return raw || 'https://kudapass.kz'
}

export function buildActivationUrl(token: string) {
  return `${getPublicSiteBaseUrl()}/activate?token=${encodeURIComponent(token)}`
}

function randomToken32Hex(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function phonesMatch(userPhone: string | null | undefined, target: string): boolean {
  const normalizedTarget = normalizePhoneToE164(target)
  if (!normalizedTarget) return false

  if (!userPhone) return false
  const nu = normalizePhoneToE164(String(userPhone))
  return nu !== null && nu === normalizedTarget
}

function resolveUserPhoneE164(args: {
  metadataPhone?: unknown
  profilePhone: string | null
  authPhone: string | null | undefined
}): string | null {
  if (typeof args.metadataPhone === 'string' && args.metadataPhone.trim()) {
    const n = normalizePhoneToE164(args.metadataPhone)
    if (n) return n
  }
  if (args.profilePhone) {
    const n = normalizePhoneToE164(args.profilePhone)
    if (n) return n
  }
  if (args.authPhone) {
    const n = normalizePhoneToE164(args.authPhone)
    if (n) return n
  }
  return null
}

/** Admin/service: fetch row by token (RLS does not apply with service role). */
export async function getActivationLinkByToken(
  token: string
): Promise<ActivationLinkRow | null> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from('activation_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return null
  }
  return data as ActivationLinkRow
}

export type ActivationPrecheck =
  | { kind: 'ok'; row: ActivationLinkRow }
  | { kind: 'revoked' }
  | { kind: 'already_used' }
  | { kind: 'expired' }

export function precheckActivationLink(row: ActivationLinkRow): ActivationPrecheck {
  if (row.status === 'revoked') {
    return { kind: 'revoked' }
  }
  if (row.status === 'activated') {
    return { kind: 'already_used' }
  }
  if (row.status === 'expired') {
    return { kind: 'expired' }
  }
  const expires = new Date(row.expires_at)
  if (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now()) {
    return { kind: 'expired' }
  }
  if (row.status !== 'issued') {
    return { kind: 'already_used' }
  }
  return { kind: 'ok', row }
}

export type CompleteActivationResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'invalid'
        | 'revoked'
        | 'expired'
        | 'already_used'
        | 'wrong_phone'
        | 'subscription_error'
    }

/**
 * Validates token, session user, and phone match; upserts subscription; marks link activated.
 * Uses service role after Supabase Auth session is verified by caller.
 */
export async function completeActivation(args: {
  userId: string
  token: string
}): Promise<CompleteActivationResult> {
  const row = await getActivationLinkByToken(args.token)
  if (!row) {
    return { ok: false, reason: 'invalid' }
  }

  const pre = precheckActivationLink(row)
  if (pre.kind === 'revoked') {
    return { ok: false, reason: 'revoked' }
  }
  if (pre.kind === 'already_used') {
    return { ok: false, reason: 'already_used' }
  }
  if (pre.kind === 'expired') {
    return { ok: false, reason: 'expired' }
  }

  const admin = createSupabaseAdminClient()

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(args.userId)
  if (userErr || !userData?.user) {
    return { ok: false, reason: 'invalid' }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', args.userId)
    .maybeSingle()

  const resolved = resolveUserPhoneE164({
    metadataPhone: userData.user.user_metadata?.phone_e164,
    profilePhone: profile?.phone ?? null,
    authPhone: userData.user.phone,
  })

  const candidates = [
    resolved,
    typeof userData.user.user_metadata?.phone_e164 === 'string'
      ? userData.user.user_metadata.phone_e164
      : null,
    profile?.phone,
    userData.user.phone,
  ]

  const targetPhone = pre.row.phone_target
  const phoneOk = candidates.some((c) => (c ? phonesMatch(c, targetPhone) : false))

  if (!phoneOk) {
    return { ok: false, reason: 'wrong_phone' }
  }

  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 30)
  const startDateString = today.toISOString().slice(0, 10)
  const endDateString = endDate.toISOString().slice(0, 10)

  const { data: existingSubscription } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSubscription?.id) {
    const { error: subscriptionUpdateError } = await admin
      .from('subscriptions')
      .update({
        status: 'active',
        plan_name: 'monthly_almaty',
        start_date: startDateString,
        end_date: endDateString,
      })
      .eq('id', existingSubscription.id)

    if (subscriptionUpdateError) {
      return { ok: false, reason: 'subscription_error' }
    }
  } else {
    const { error: subscriptionInsertError } = await admin.from('subscriptions').insert({
      user_id: args.userId,
      status: 'active',
      plan_name: 'monthly_almaty',
      start_date: startDateString,
      end_date: endDateString,
    })

    if (subscriptionInsertError) {
      return { ok: false, reason: 'subscription_error' }
    }
  }

  const metaRaw =
    typeof userData.user.user_metadata?.phone_e164 === 'string'
      ? userData.user.user_metadata.phone_e164
      : null
  const phoneToSync = metaRaw ? normalizePhoneToE164(metaRaw) : resolved
  if (phoneToSync && !profile?.phone) {
    await admin.from('profiles').update({ phone: phoneToSync }).eq('id', args.userId)
  }

  const { data: updatedLink, error: linkUpdateError } = await admin
    .from('activation_links')
    .update({
      status: 'activated',
      activated_user_id: args.userId,
      activated_at: new Date().toISOString(),
    })
    .eq('token', args.token)
    .eq('status', 'issued')
    .select('id')
    .maybeSingle()

  if (linkUpdateError || !updatedLink) {
    return { ok: false, reason: 'already_used' }
  }

  revalidatePath('/app/me')
  revalidatePath('/admin/activation-links')
  revalidatePath('/activate')

  return { ok: true }
}

export function generateHashedActivationToken() {
  return randomToken32Hex()
}
