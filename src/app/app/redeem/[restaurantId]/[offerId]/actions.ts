'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getGuestAccess } from '@/lib/guest-access'
import { logServerError } from '@/lib/safe-errors'

export type ExtendRedeemState =
  | { error?: string; ok?: boolean; expiresAt?: string }
  | null

type ExtendRpcResult = {
  ok: boolean
  reason?:
    | 'login_required'
    | 'not_found'
    | 'already_used'
    | 'already_extended'
    | 'extend_window_closed'
  expires_at?: string
}

type IssueRpcResult = {
  ok: boolean
  reason?:
    | 'login_required'
    | 'phone_not_verified'
    | 'offer_unavailable'
    | 'active_token'
    | 'usable_hours'
    | 'server_error'
  token_id?: string
}

const EXTEND_ERRORS: Record<NonNullable<ExtendRpcResult['reason']>, string> = {
  login_required: 'Войдите в аккаунт.',
  not_found: 'Код не найден.',
  already_used: 'Код уже использован.',
  already_extended: 'Продление уже применялось.',
  extend_window_closed: 'Время для продления истекло (прошёл час с выдачи).',
}

function redeemPath(restaurantId: string, offerId: string) {
  return `/app/redeem/${restaurantId}/${offerId}`
}

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

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('extend_redeem_token', {
    p_token_id: tokenId,
  })

  if (error) {
    logServerError('redeem/extend', error)
    return { error: 'Не удалось продлить. Попробуйте снова.' }
  }

  const result = data as ExtendRpcResult | null
  if (!result?.ok || !result.expires_at) {
    return {
      error:
        EXTEND_ERRORS[result?.reason ?? 'not_found'] ?? 'Не удалось продлить. Попробуйте снова.',
    }
  }

  if (restaurantId && offerId) {
    revalidatePath(redeemPath(restaurantId, offerId))
  }

  return { ok: true, expiresAt: result.expires_at }
}

export async function generateRedeemToken(formData: FormData) {
  const restaurantId = String(formData.get('restaurantId') || '')
  const offerId = String(formData.get('offerId') || '')

  if (!restaurantId || !offerId) {
    redirect('/almaty')
  }

  const backUrl = redeemPath(restaurantId, offerId)

  const access = await getGuestAccess()
  if (access.kind !== 'member') {
    redirect(`/login?next=${encodeURIComponent(backUrl)}`)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('issue_redeem_token', {
    p_restaurant_id: restaurantId,
    p_offer_id: offerId,
  })

  if (error) {
    logServerError('redeem/issue', error)
    redirect(`${backUrl}?error=server_error`)
  }

  const result = data as IssueRpcResult | null
  if (!result?.ok) {
    const reason = result?.reason ?? 'server_error'
    if (reason === 'login_required' || reason === 'phone_not_verified') {
      redirect(`/login?next=${encodeURIComponent(backUrl)}`)
    }
    redirect(`${backUrl}?error=${reason}`)
  }

  revalidatePath(backUrl)
  redirect(`${backUrl}?success=code_generated`)
}
