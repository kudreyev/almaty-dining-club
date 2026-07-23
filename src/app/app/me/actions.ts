'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
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
 * (end_date). Ставим статус 'cancelled' (автосписаний больше не будет), чтобы
 * состояние пережило перезагрузку страницы. paidUntil (end_date) не трогаем.
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
    if (!tiptopId || !subscription) {
      return { ok: false, error: 'Активная подписка TipTop Pay не найдена.' }
    }

    // TipTop Pay: останавливаем будущие списания. Только при Success: true
    // фиксируем отмену у нас, иначе пользователь мог бы «отменить» вслепую.
    const result = (await cancelSubscription(tiptopId)) as {
      Success?: boolean
      Message?: string | null
    }
    if (!result?.Success) {
      logServerError(
        'app/me/cancelMySubscription',
        new Error(`TipTop cancel failed: ${result?.Message ?? 'unknown'}`),
      )
      return {
        ok: false,
        error: 'Не удалось отменить подписку. Попробуйте позже.',
      }
    }

    // Пишем статус в БД admin-клиентом: у subscriptions нет UPDATE-политики RLS,
    // поэтому обычный клиент пользователя строку не изменит. paidUntil не трогаем.
    const admin = createSupabaseAdminClient()
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subscription.id)
    if (updateError) throw updateError

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
