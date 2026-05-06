'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getStaffSessionRestaurantId,
  establishStaffBrowserSession,
} from '@/lib/staff-session'
import {
  assertStaffRedeemNotRateLimited,
  recordStaffRedeemFailure,
} from '@/lib/staff-redeem-rate-limit'

async function requireStaffContext() {
  const restaurantId = await getStaffSessionRestaurantId()

  if (!restaurantId) {
    redirect('/staff/login')
  }

  const supabase = await createSupabaseServerClient()

  const { data: staffUsers } = await supabase
    .from('staff_users')
    .select('id, restaurant_id, is_active')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .limit(1)

  const staffUser = staffUsers?.[0]

  if (!staffUser) {
    redirect('/staff/login')
  }

  return { supabase, restaurantId, staffUserId: staffUser.id }
}

export async function verifyStaffPinForRedeem(formData: FormData) {
  await assertStaffRedeemNotRateLimited()

  const restaurantId = String(formData.get('restaurantId') || '').trim()
  const pinCode = String(formData.get('pinCode') || '').trim()
  const tokenCode = String(formData.get('tokenCode') || '').trim()
  if (!restaurantId || !pinCode || !tokenCode) {
    const qp = new URLSearchParams()
    if (tokenCode) qp.set('token', tokenCode)
    qp.set('error', 'missing_pin')
    redirect(`/staff/redeem?${qp.toString()}`)
  }

  const admin = createSupabaseAdminClient()
  const { data: tokenRow } = await admin
    .from('redeem_tokens')
    .select('restaurant_id')
    .eq('token_code', tokenCode)
    .maybeSingle<{ restaurant_id: string }>()

  if (!tokenRow || tokenRow.restaurant_id !== restaurantId) {
    const limited = await recordStaffRedeemFailure('invalid_token')
    redirect(
      `/staff/redeem?token=${encodeURIComponent(tokenCode)}&error=${limited ? 'rate_limited' : 'invalid_token'}`
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data: rows, error } = await supabase
    .from('staff_users')
    .select('id, restaurant_id, pin_code, is_active')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .limit(10)

  if (error || !rows?.length) {
    const limited = await recordStaffRedeemFailure('pin_verify_failed')
    redirect(
      `/staff/redeem?token=${encodeURIComponent(tokenCode)}&error=${limited ? 'rate_limited' : 'pin_verify_failed'}`
    )
  }

  const matched = rows.find((row) => String(row.pin_code).trim() === pinCode)
  if (!matched) {
    const limited = await recordStaffRedeemFailure('invalid_pin')
    redirect(
      `/staff/redeem?token=${encodeURIComponent(tokenCode)}&error=${limited ? 'rate_limited' : 'invalid_pin'}`
    )
  }

  const session = await establishStaffBrowserSession(restaurantId)
  if (!session.ok) {
    redirect(`/staff/redeem?token=${encodeURIComponent(tokenCode)}&error=session_error`)
  }

  redirect(`/staff/redeem?token=${encodeURIComponent(tokenCode)}`)
}

export async function redeemTokenByCode(formData: FormData) {
  await assertStaffRedeemNotRateLimited()

  const tokenCode = String(formData.get('tokenCode') || '').trim()

  if (!tokenCode) {
    redirect('/staff/redeem?error=missing_code')
  }

  const { supabase, restaurantId, staffUserId } = await requireStaffContext()

  const nowIso = new Date().toISOString()

  const { data: tokens } = await supabase
    .from('redeem_tokens')
    .select(
      'id, user_id, restaurant_id, offer_id, token_code, status, expires_at, redeemed_at, used_at'
    )
    .eq('token_code', tokenCode)
    .eq('restaurant_id', restaurantId)
    .limit(1)

  const token = tokens?.[0] as
    | {
        id: string
        user_id: string
        restaurant_id: string
        offer_id: string
        token_code: string
        status: string
        expires_at: string
        redeemed_at: string | null
        used_at: string | null
      }
    | undefined

  if (!token) {
    const limited = await recordStaffRedeemFailure('not_found')
    redirect(`/staff/redeem?error=${limited ? 'rate_limited' : 'not_found'}`)
  }

  if (token.used_at != null || token.status !== 'active') {
    const limited = await recordStaffRedeemFailure('already_used')
    redirect(`/staff/redeem?error=${limited ? 'rate_limited' : 'already_used'}`)
  }

  if (token.expires_at <= nowIso) {
    const limited = await recordStaffRedeemFailure('expired')
    redirect(`/staff/redeem?error=${limited ? 'rate_limited' : 'expired'}`)
  }

  const redeemedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('redeem_tokens')
    .update({
      status: 'redeemed',
      used_at: redeemedAt,
      redeemed_at: redeemedAt,
      redeemed_by_staff_id: staffUserId,
    })
    .eq('id', token.id)

  if (updateError) {
    redirect('/staff/redeem?error=update_failed')
  }

  const { error: insertRedemptionError } = await supabase
    .from('redemptions')
    .insert({
      user_id: token.user_id,
      restaurant_id: token.restaurant_id,
      offer_id: token.offer_id,
      redeem_token_id: token.id,
      staff_user_id: staffUserId,
      redeemed_at: redeemedAt,
    })

  if (insertRedemptionError) {
    redirect('/staff/redeem?error=redemption_failed')
  }

  revalidatePath('/staff/redeem')
  revalidatePath('/app/me')

  redirect('/staff/redeem?success=confirmed')
}
