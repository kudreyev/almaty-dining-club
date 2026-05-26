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

const REDEEM_IDEMPOTENCY_WINDOW_SECONDS = 60

type RedeemTokenAtomicResult = {
  ok?: boolean
  reason?: string
  idempotent?: boolean
}

export async function redeemTokenByCode(formData: FormData) {
  await assertStaffRedeemNotRateLimited()

  const tokenCode = String(formData.get('tokenCode') || '').trim()

  if (!tokenCode) {
    redirect('/staff/redeem?error=missing_code')
  }

  const { restaurantId, staffUserId } = await requireStaffContext()
  const admin = createSupabaseAdminClient()

  const { data: rpcRaw, error: rpcError } = await admin.rpc('redeem_token_atomic', {
    p_token_code: tokenCode,
    p_restaurant_id: restaurantId,
    p_staff_user_id: staffUserId,
    p_idempotency_window_seconds: REDEEM_IDEMPOTENCY_WINDOW_SECONDS,
  })

  if (rpcError) {
    redirect('/staff/redeem?error=redemption_failed')
  }

  const result = rpcRaw as RedeemTokenAtomicResult | null
  if (!result || typeof result.ok !== 'boolean') {
    redirect('/staff/redeem?error=redemption_failed')
  }

  if (!result.ok) {
    const reason = result.reason ?? 'redemption_failed'
    const failureKind =
      reason === 'not_found'
        ? 'not_found'
        : reason === 'already_used'
          ? 'already_used'
          : reason === 'expired'
            ? 'expired'
            : null

    if (failureKind) {
      const limited = await recordStaffRedeemFailure(failureKind)
      redirect(`/staff/redeem?error=${limited ? 'rate_limited' : failureKind}`)
    }

    redirect('/staff/redeem?error=redemption_failed')
  }

  revalidatePath('/staff/redeem')
  revalidatePath('/staff/history')
  revalidatePath('/app/me')

  redirect('/staff/redeem?success=confirmed')
}
