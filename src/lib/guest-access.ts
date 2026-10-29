import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Доступ к кодам бесплатный: нужен вход и подтверждённый телефон.
 * profiles.phone заполняется только после успешного OTP (ensureProfilePhone).
 */
export type GuestAccess =
  | { kind: 'guest'; user: null; phone: null; isFounder: false }
  | { kind: 'unverified'; user: User; phone: null; isFounder: boolean }
  | { kind: 'member'; user: User; phone: string; isFounder: boolean }

type ProfileAccessRow = {
  phone: string | null
  is_founder: boolean | null
}

export async function getGuestAccess(): Promise<GuestAccess> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { kind: 'guest', user: null, phone: null, isFounder: false }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, is_founder')
    .eq('id', user.id)
    .maybeSingle<ProfileAccessRow>()

  const phone = profile?.phone?.trim() || null
  const isFounder = profile?.is_founder === true

  if (!phone) {
    return { kind: 'unverified', user, phone: null, isFounder }
  }

  return { kind: 'member', user, phone, isFounder }
}

const DEFAULT_REDEMPTION_VALUE_KZT = 2500

export type UserSavings = {
  amountKzt: number
  redemptionsCount: number
  hasRedemptions: boolean
}

type RedemptionWithOffer = {
  offers: { estimated_value: number | null } | null
}

export async function getUserSavings(userId: string): Promise<UserSavings> {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from('redemptions')
    .select('offers ( estimated_value )')
    .eq('user_id', userId)
    .returns<RedemptionWithOffer[]>()

  const rows = data ?? []
  let total = 0
  for (const row of rows) {
    const value = row.offers?.estimated_value
    total += typeof value === 'number' && value > 0 ? value : DEFAULT_REDEMPTION_VALUE_KZT
  }

  return {
    amountKzt: total,
    redemptionsCount: rows.length,
    hasRedemptions: rows.length > 0,
  }
}
