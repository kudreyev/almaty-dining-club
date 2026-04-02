'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getCurrentUserSubscription,
  isSubscriptionCurrentlyActive,
} from '@/lib/subscription'
import { resolveOfferCooldownDays } from '@/lib/offers'

function generateTokenCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function generateRedeemToken(formData: FormData) {
  const restaurantId = String(formData.get('restaurantId') || '')
  const offerId = String(formData.get('offerId') || '')

  if (!restaurantId || !offerId) {
    redirect('/almaty')
  }

  const backUrl = `/app/redeem/${restaurantId}/${offerId}`

  const { user, subscription } = await getCurrentUserSubscription()

  if (!user) {
    redirect('/login')
  }

  if (!isSubscriptionCurrentlyActive(subscription)) {
    redirect('/pricing')
  }

  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  // 1) Уже есть активный токен
  const { data: activeTokens, error: activeTokensError } = await supabase
    .from('redeem_tokens')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)

  if (activeTokensError) {
    redirect(`${backUrl}?error=server_error`)
  }

  if (activeTokens && activeTokens.length > 0) {
    redirect(`${backUrl}?error=active_token`)
  }

  const { data: offerForCooldown, error: offerCooldownError } = await supabase
    .from('offers')
    .select('cooldown_days')
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<{ cooldown_days: number | null }>()

  if (offerCooldownError || !offerForCooldown) {
    redirect(`${backUrl}?error=server_error`)
  }

  const cooldownDays = resolveOfferCooldownDays(offerForCooldown.cooldown_days)

  // 2) Cooldown по офферу: 1 раз в N дней
  const cooldownStart = new Date()
  cooldownStart.setDate(cooldownStart.getDate() - cooldownDays)

  const { data: recentRedemptions, error: recentRedemptionsError } = await supabase
    .from('redemptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('offer_id', offerId)
    .gte('redeemed_at', cooldownStart.toISOString())
    .order('redeemed_at', { ascending: false })
    .limit(1)

  if (recentRedemptionsError) {
    redirect(`${backUrl}?error=server_error`)
  }

  if (recentRedemptions && recentRedemptions.length > 0) {
    redirect(`${backUrl}?error=cooldown_offer`)
  }

  // 3) Создаём токен на 10 минут
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 10)

  const tokenCode = generateTokenCode()

  const { error: insertError } = await supabase.from('redeem_tokens').insert({
    user_id: user.id,
    restaurant_id: restaurantId,
    offer_id: offerId,
    token_code: tokenCode,
    status: 'active',
    expires_at: expiresAt.toISOString(),
  })

  if (insertError) {
    redirect(`${backUrl}?error=server_error`)
  }

  revalidatePath(backUrl)
  redirect(`${backUrl}?success=code_generated`)
}