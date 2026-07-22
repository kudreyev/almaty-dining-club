'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { cancelSubscription } from '@/lib/tiptoppay'
import {
  getFallbackByContext,
  getUserFacingError,
  logServerError,
} from '@/lib/safe-errors'

type CancelResult = { ok: boolean; error?: string }

/**
 * Отмена подписки TipTop Pay из личного кабинета.
 * Доступ НЕ закрываем сразу — он сохраняется до конца оплаченного периода
 * (end_date). Локальный статус сменит Recurrent-вебхук, когда TipTop Pay
 * подтвердит отмену.
 */
export async function cancelMySubscription(): Promise<CancelResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { ok: false, error: 'Нужно войти в аккаунт.' }
    }

    // RLS: пользователь видит только свои подписки.
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, tiptop_subscription_id')
      .eq('user_id', user.id)
      .not('tiptop_subscription_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; tiptop_subscription_id: string | null }>()

    const tiptopId = subscription?.tiptop_subscription_id
    if (!tiptopId) {
      return { ok: false, error: 'Активная подписка TipTop Pay не найдена.' }
    }

    await cancelSubscription(tiptopId)

    revalidatePath('/app/me')
    return { ok: true }
  } catch (error) {
    logServerError('app/me/cancelMySubscription', error)
    return {
      ok: false,
      error: getUserFacingError(error, getFallbackByContext('subscription')),
    }
  }
}
