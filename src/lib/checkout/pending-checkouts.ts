/**
 * pending_checkouts: лиды до оплаты + one-time token автологина.
 */

import crypto from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { isSubscriptionCurrentlyActive } from '@/lib/subscription'
import { phoneLookupKeys } from '@/lib/activation-links-list'
import type { UtmAttribution } from '@/lib/utm'

export const CHECKOUT_TOKEN_COOKIE = 'kc_checkout_token'
export const CHECKOUT_TOKEN_MAX_AGE_SEC = 24 * 60 * 60

export type PendingCheckoutRow = {
  id: string
  phone: string
  one_time_token: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  promo_code: string | null
  source: string | null
  status: 'pending' | 'paid' | 'expired'
  existing_account: boolean
  user_id: string | null
  created_at: string
  expires_at: string
  paid_at: string | null
  token_used_at: string | null
}

function admin() {
  return createSupabaseAdminClient()
}

export function generateCheckoutToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** Активная продуктовая подписка у аккаунта с этим телефоном. */
export async function phoneHasActiveSubscription(
  phoneE164: string,
): Promise<boolean> {
  const db = admin()
  const keys = phoneLookupKeys(phoneE164)
  if (keys.length === 0) return false

  const { data: profiles } = await db
    .from('profiles')
    .select('id, phone')
    .in('phone', keys)
    .returns<{ id: string; phone: string | null }[]>()

  const userIds = [...new Set((profiles ?? []).map((p) => p.id))]
  if (userIds.length === 0) return false

  const { data: subs } = await db
    .from('subscriptions')
    .select('user_id, status, start_date, end_date')
    .in('user_id', userIds)
    .in('status', ['active', 'cancelled'])
    .returns<
      {
        user_id: string
        status: string
        start_date: string | null
        end_date: string | null
      }[]
    >()

  return (subs ?? []).some((s) => isSubscriptionCurrentlyActive(s))
}

export async function createPendingCheckout(args: {
  phoneRaw: string
  utm?: UtmAttribution | null
  source?: string | null
  /** Промокод из поля чекаута — приоритетнее cookie UTM. */
  promoCode?: string | null
}): Promise<{
  checkout: PendingCheckoutRow
  phone: string
  existingAccount: boolean
  token: string
}> {
  const phone = normalizePhoneToE164(args.phoneRaw)
  if (!phone) {
    throw new Error('INVALID_PHONE')
  }

  const existingAccount = await phoneHasActiveSubscription(phone)
  const token = generateCheckoutToken()
  const expiresAt = new Date(Date.now() + CHECKOUT_TOKEN_MAX_AGE_SEC * 1000)
  const promoFromForm =
    typeof args.promoCode === 'string' && args.promoCode.trim()
      ? args.promoCode.trim().slice(0, 64).toUpperCase()
      : null

  const insertRow = {
    phone,
    one_time_token: token,
    utm_source: args.utm?.utm_source ?? null,
    utm_medium: args.utm?.utm_medium ?? null,
    utm_campaign: args.utm?.utm_campaign ?? null,
    promo_code: promoFromForm ?? args.utm?.promo_code ?? null,
    source: args.source?.trim().slice(0, 128) || null,
    status: 'pending' as const,
    existing_account: existingAccount,
    expires_at: expiresAt.toISOString(),
  }

  const { data, error } = await admin()
    .from('pending_checkouts')
    .insert(insertRow)
    .select('*')
    .single<PendingCheckoutRow>()

  if (error) throw error

  return {
    checkout: data,
    phone,
    existingAccount,
    token,
  }
}

export async function findPendingCheckoutByToken(
  token: string,
): Promise<PendingCheckoutRow | null> {
  if (!token) return null
  const { data } = await admin()
    .from('pending_checkouts')
    .select('*')
    .eq('one_time_token', token)
    .maybeSingle<PendingCheckoutRow>()
  return data ?? null
}

/** Последний незакрытый pending по телефону (AccountId виджета). */
export async function findPendingCheckoutByPhone(
  phone: string,
): Promise<PendingCheckoutRow | null> {
  const normalized = normalizePhoneToE164(phone) ?? phone
  /** Предпочитаем незакрытый pending (лид текущей попытки). */
  const { data: pending } = await admin()
    .from('pending_checkouts')
    .select('*')
    .eq('phone', normalized)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PendingCheckoutRow>()
  if (pending) return pending

  const { data } = await admin()
    .from('pending_checkouts')
    .select('*')
    .eq('phone', normalized)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PendingCheckoutRow>()
  return data ?? null
}

export async function markPendingCheckoutPaid(args: {
  id: string
  userId: string
}): Promise<PendingCheckoutRow> {
  const { data, error } = await admin()
    .from('pending_checkouts')
    .update({
      status: 'paid',
      user_id: args.userId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', args.id)
    .select('*')
    .single<PendingCheckoutRow>()
  if (error) throw error
  return data
}

export async function invalidateCheckoutToken(
  id: string,
): Promise<void> {
  await admin()
    .from('pending_checkouts')
    .update({ token_used_at: new Date().toISOString() })
    .eq('id', id)
}

export function isCheckoutTokenValid(row: PendingCheckoutRow): boolean {
  if (row.token_used_at) return false
  if (new Date(row.expires_at).getTime() < Date.now()) return false
  return true
}

/** Attribution из pending для ledger (если JsonData пустой). */
export function attributionFromPending(
  row: Pick<
    PendingCheckoutRow,
    'utm_source' | 'utm_medium' | 'utm_campaign' | 'promo_code'
  >,
): UtmAttribution {
  return {
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    promo_code: row.promo_code,
  }
}
