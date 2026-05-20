import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { ensureProfilePhone } from '@/lib/profile-sync'

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
  // Canonical public domain for shareable links (WhatsApp, SMS, etc).
  // Avoid leaking preview / vercel.app domains into customer-facing messages.
  const canonical = 'https://kudaclub.kz'

  const raw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  if (!raw) return canonical

  const lower = raw.toLowerCase()
  if (
    lower.includes('vercel.app') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1')
  ) {
    return canonical
  }

  return raw
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
 * Validates token, session user, and phone match; marks link activated + upserts subscription
 * via Postgres RPC (single transaction — subscription failure rolls back claim).
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

  const { data: rpcRaw, error: rpcError } = await admin.rpc(
    'activate_subscription_atomic',
    {
      p_token: args.token,
      p_user_id: args.userId,
    }
  )

  if (rpcError) {
    return { ok: false, reason: 'subscription_error' }
  }

  const rpcPayload = rpcRaw as { ok?: unknown; reason?: unknown } | null
  if (!rpcPayload || typeof rpcPayload.ok !== 'boolean') {
    return { ok: false, reason: 'subscription_error' }
  }

  if (!rpcPayload.ok) {
    if (rpcPayload.reason === 'already_used') {
      return { ok: false, reason: 'already_used' }
    }
    return { ok: false, reason: 'subscription_error' }
  }

  const metaRaw =
    typeof userData.user.user_metadata?.phone_e164 === 'string'
      ? userData.user.user_metadata.phone_e164
      : null
  const phoneToSync = metaRaw ? normalizePhoneToE164(metaRaw) : resolved
  // Always sync, even if profile already has a phone (may need updating).
  await ensureProfilePhone(args.userId, phoneToSync)

  return { ok: true }
}

export function generateHashedActivationToken() {
  return randomToken32Hex()
}
