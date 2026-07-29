/**
 * Продуктовая активация/деактивация subscriptions из TipTop webhooks.
 * Используется и /api/tiptoppay/*, и /api/webhooks/ttp/*.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendPurchaseEvent } from '@/lib/meta-capi'
import {
  buildTipTopPurchaseEventId,
  isTipTopInstallmentInvoiceId,
} from '@/lib/meta-purchase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function resolvePhoneForCapi(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle<{ phone: string | null }>()
  if (profile?.phone) return profile.phone

  const { data: authData } = await admin.auth.admin.getUserById(userId)
  const metaPhone = authData.user?.user_metadata?.phone_e164
  if (typeof metaPhone === 'string' && metaPhone.trim()) return metaPhone.trim()
  if (typeof authData.user?.phone === 'string' && authData.user.phone.trim()) {
    return authData.user.phone.trim()
  }
  return null
}

export function isValidUserAccountId(accountId: string | null | undefined): boolean {
  return Boolean(accountId && UUID_RE.test(accountId))
}

/** Активирует/продлевает public.subscriptions по успешному Pay. */
export async function activateProductSubscription(args: {
  accountId: string
  subscriptionId: string | null
  invoiceId: string | null
}): Promise<void> {
  const { accountId, subscriptionId, invoiceId } = args
  if (!isValidUserAccountId(accountId)) {
    throw new Error(`invalid AccountId: ${accountId}`)
  }

  const admin = createSupabaseAdminClient()
  const startDate = toDateString(new Date())
  const paidUntil = new Date()
  paidUntil.setMonth(paidUntil.getMonth() + 1)
  const endDate = toDateString(paidUntil)

  type SubRow = { id: string; tiptop_subscription_id: string | null }
  let subRow: SubRow | null = null

  if (subscriptionId) {
    const { data } = await admin
      .from('subscriptions')
      .select('id, tiptop_subscription_id')
      .eq('tiptop_subscription_id', subscriptionId)
      .limit(1)
      .maybeSingle<SubRow>()
    subRow = data ?? null
  }

  if (!subRow) {
    const { data } = await admin
      .from('subscriptions')
      .select('id, tiptop_subscription_id')
      .eq('user_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubRow>()
    subRow = data ?? null
  }

  const patch = {
    status: 'active' as const,
    plan_name: 'monthly_tiptoppay',
    plan_type: 'paid',
    start_date: startDate,
    end_date: endDate,
  }

  if (subRow) {
    const idPatch =
      subscriptionId && !subRow.tiptop_subscription_id
        ? { tiptop_subscription_id: subscriptionId }
        : {}
    const { error } = await admin
      .from('subscriptions')
      .update({ ...patch, ...idPatch })
      .eq('id', subRow.id)
    if (error) throw error
  } else {
    const { error } = await admin.from('subscriptions').insert({
      user_id: accountId,
      ...patch,
      tiptop_subscription_id: subscriptionId,
    })
    if (error) throw error
  }

  if (isTipTopInstallmentInvoiceId(invoiceId)) {
    const phone = await resolvePhoneForCapi(admin, accountId)
    if (phone) {
      void sendPurchaseEvent({
        userId: accountId,
        phone,
        eventId: buildTipTopPurchaseEventId(invoiceId),
      })
    }
  }
}

/** Зеркалирует Recurrent-статус в public.subscriptions. */
export async function applyProductRecurrentStatus(args: {
  accountId: string | null
  subscriptionId: string | null
  status: string
}): Promise<void> {
  const { accountId, subscriptionId, status } = args
  const admin = createSupabaseAdminClient()

  type SubRow = {
    id: string
    end_date: string | null
    tiptop_subscription_id: string | null
  }
  let subRow: SubRow | null = null

  if (subscriptionId) {
    const { data } = await admin
      .from('subscriptions')
      .select('id, end_date, tiptop_subscription_id')
      .eq('tiptop_subscription_id', subscriptionId)
      .limit(1)
      .maybeSingle<SubRow>()
    subRow = data ?? null
  }

  if (!subRow && accountId) {
    const { data } = await admin
      .from('subscriptions')
      .select('id, end_date, tiptop_subscription_id')
      .eq('user_id', accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubRow>()
    subRow = data ?? null
  }

  if (!subRow) return

  const idPatch =
    subscriptionId && !subRow.tiptop_subscription_id
      ? { tiptop_subscription_id: subscriptionId }
      : {}

  if (status === 'Active') {
    await admin
      .from('subscriptions')
      .update({ status: 'active', ...idPatch })
      .eq('id', subRow.id)
  } else if (
    status === 'Cancelled' ||
    status === 'Rejected' ||
    status === 'Expired'
  ) {
    const today = new Date().toISOString().slice(0, 10)
    const periodEnded = !subRow.end_date || subRow.end_date < today
    await admin
      .from('subscriptions')
      .update({ status: periodEnded ? 'inactive' : 'cancelled', ...idPatch })
      .eq('id', subRow.id)
  } else if (Object.keys(idPatch).length > 0) {
    await admin.from('subscriptions').update(idPatch).eq('id', subRow.id)
  }
}
