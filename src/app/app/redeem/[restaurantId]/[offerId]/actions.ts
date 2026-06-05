'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getCurrentUserSubscription,
  isSubscriptionCurrentlyActive,
} from '@/lib/subscription'
import { DEFAULT_TZ } from '@/lib/opening-hours'
import { isOfferUsableNow, resolveOfferCooldownDays } from '@/lib/offers'
import { generateRedeemCode } from '@/lib/crypto-random'

export type ExtendRedeemState =
  | { error?: string; ok?: boolean; expiresAt?: string }
  | null

export async function extendRedeemToken(
  _prev: ExtendRedeemState,
  formData: FormData
): Promise<ExtendRedeemState> {
  const tokenId = String(formData.get('tokenId') || '').trim()
  const restaurantId = String(formData.get('restaurantId') || '').trim()
  const offerId = String(formData.get('offerId') || '').trim()
  if (!tokenId) {
    return { error: 'Некорректный запрос.' }
  }

  const { user, subscription } = await getCurrentUserSubscription()
  if (!user) {
    return { error: 'Войдите в аккаунт.' }
  }
  if (!isSubscriptionCurrentlyActive(subscription)) {
    return { error: 'Нужна активная подписка.' }
  }

  const supabase = await createSupabaseServerClient()
  const nowIso = new Date().toISOString()

  const { data: row, error: fetchError } = await supabase
    .from('redeem_tokens')
    .select(
      'id, used_at, extended_once, extend_deadline_at, restaurant_id, offer_id'
    )
    .eq('id', tokenId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle<{
      id: string
      used_at: string | null
      extended_once: boolean
      extend_deadline_at: string
      restaurant_id: string
      offer_id: string
    }>()

  if (fetchError || !row) {
    return { error: 'Код не найден.' }
  }
  if (
    restaurantId &&
    offerId &&
    (row.restaurant_id !== restaurantId || row.offer_id !== offerId)
  ) {
    return { error: 'Некорректный запрос.' }
  }
  if (row.used_at != null) {
    return { error: 'Код уже использован.' }
  }
  if (row.extended_once) {
    return { error: 'Продление уже применялось.' }
  }
  if (nowIso > row.extend_deadline_at) {
    return { error: 'Время для продления истекло (прошёл час с выдачи).' }
  }

  const newExpires = new Date()
  newExpires.setMinutes(newExpires.getMinutes() + 10)

  const { error: updateError } = await supabase
    .from('redeem_tokens')
    .update({
      expires_at: newExpires.toISOString(),
      extended_once: true,
    })
    .eq('id', tokenId)
    .eq('user_id', user.id)
    .is('used_at', null)
    .eq('extended_once', false)

  if (updateError) {
    return { error: 'Не удалось продлить. Попробуйте снова.' }
  }

  if (restaurantId && offerId) {
    revalidatePath(`/app/redeem/${restaurantId}/${offerId}`)
  }

  return { ok: true, expiresAt: newExpires.toISOString() }
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
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)

  if (activeTokensError) {
    redirect(`${backUrl}?error=server_error`)
  }

  if (activeTokens && activeTokens.length > 0) {
    redirect(`${backUrl}?error=active_token`)
  }

  const { data: offerForRedeem, error: offerRedeemError } = await supabase
    .from('offers')
    .select('cooldown_days, usable_from_time, usable_to_time')
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle<{
      cooldown_days: number | null
      usable_from_time: string | null
      usable_to_time: string | null
    }>()

  if (offerRedeemError || !offerForRedeem) {
    redirect(`${backUrl}?error=server_error`)
  }

  if (!isOfferUsableNow(offerForRedeem, new Date(), DEFAULT_TZ)) {
    redirect(`${backUrl}?error=usable_hours`)
  }

  const cooldownDays = resolveOfferCooldownDays(offerForRedeem.cooldown_days)

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

  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60 * 1000)
  const extendDeadlineAt = new Date(issuedAt.getTime() + 60 * 60 * 1000)

  const tokenCode = generateRedeemCode()

  const { error: insertError } = await supabase.from('redeem_tokens').insert({
    user_id: user.id,
    restaurant_id: restaurantId,
    offer_id: offerId,
    token_code: tokenCode,
    status: 'active',
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    extend_deadline_at: extendDeadlineAt.toISOString(),
    extended_once: false,
    used_at: null,
  })

  if (insertError) {
    redirect(`${backUrl}?error=server_error`)
  }

  revalidatePath(backUrl)
  redirect(`${backUrl}?success=code_generated`)
}