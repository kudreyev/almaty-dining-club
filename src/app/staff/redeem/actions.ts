'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStaffSessionRestaurantId } from '@/lib/staff-session'

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

export async function redeemTokenByCode(formData: FormData) {
  const tokenCode = String(formData.get('tokenCode') || '').trim()

  if (!tokenCode) {
    redirect('/staff/redeem?error=missing_code')
  }

  const { supabase, restaurantId, staffUserId } = await requireStaffContext()

  const nowIso = new Date().toISOString()

  const { data: tokens } = await supabase
    .from('redeem_tokens')
    .select('id, user_id, restaurant_id, offer_id, token_code, status, expires_at, redeemed_at')
    .eq('token_code', tokenCode)
    .eq('restaurant_id', restaurantId)
    .limit(1)

  const token = tokens?.[0]

  if (!token) {
    redirect('/staff/redeem?error=not_found')
  }

  if (token.status !== 'active') {
    redirect('/staff/redeem?error=already_used')
  }

  if (token.expires_at <= nowIso) {
    await supabase
      .from('redeem_tokens')
      .update({ status: 'expired' })
      .eq('id', token.id)

    redirect('/staff/redeem?error=expired')
  }

  const redeemedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('redeem_tokens')
    .update({
      status: 'redeemed',
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

  redirect(`/staff/redeem?success=${tokenCode}`)
}