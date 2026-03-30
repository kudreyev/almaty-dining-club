'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAnalyticsEvent } from '@/lib/analytics'

function toSyntheticEmail(phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, '')
  return `wa_${digits}@wa.local`
}

type TransferResult = {
  ok: boolean
  error?: string
  details?: string
}

async function findUserByPhone(phoneE164: string) {
  const admin = createSupabaseAdminClient()
  const email = toSyntheticEmail(phoneE164)

  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return null

  const match = users.users.find((u) => {
    if (u.email === email) return true
    if (u.user_metadata?.phone_e164 === phoneE164) return true
    if (u.phone === phoneE164) return true
    return false
  })

  return match ?? null
}

export async function transferSubscription(formData: FormData): Promise<TransferResult> {
  await requireAdmin()

  const fromPhoneRaw = String(formData.get('from_phone') ?? '').trim()
  const toPhoneRaw = String(formData.get('to_phone') ?? '').trim()

  const fromPhone = normalizePhoneToE164(fromPhoneRaw)
  const toPhone = normalizePhoneToE164(toPhoneRaw)

  if (!fromPhone) return { ok: false, error: 'Некорректный номер отправителя.' }
  if (!toPhone) return { ok: false, error: 'Некорректный номер получателя.' }
  if (fromPhone === toPhone) return { ok: false, error: 'Номера совпадают.' }

  const fromUser = await findUserByPhone(fromPhone)
  if (!fromUser) {
    return { ok: false, error: `Пользователь с номером ${fromPhone} не найден.` }
  }

  const admin = createSupabaseAdminClient()

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id, status, plan_name, start_date, end_date')
    .eq('user_id', fromUser.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscription) {
    return { ok: false, error: `У ${fromPhone} нет активной подписки.` }
  }

  const toUser = await findUserByPhone(toPhone)
  if (!toUser) {
    return { ok: false, error: `Пользователь с номером ${toPhone} не найден. Он должен сначала войти через WhatsApp.` }
  }

  const { data: existingToSub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', toUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingToSub) {
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        status: subscription.status,
        plan_name: subscription.plan_name,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
      })
      .eq('id', existingToSub.id)

    if (updateError) {
      return { ok: false, error: `Ошибка обновления подписки получателя: ${updateError.message}` }
    }
  } else {
    const { error: insertError } = await admin.from('subscriptions').insert({
      user_id: toUser.id,
      status: subscription.status,
      plan_name: subscription.plan_name,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
    })

    if (insertError) {
      return { ok: false, error: `Ошибка создания подписки: ${insertError.message}` }
    }
  }

  await admin
    .from('subscriptions')
    .update({ status: 'inactive' })
    .eq('id', subscription.id)

  await admin
    .from('activation_links')
    .update({ phone_target: toPhone })
    .eq('phone_target', fromPhone)
    .eq('status', 'issued')

  await logAnalyticsEvent({
    event_name: 'activation_activated',
    user_id: toUser.id,
    phone_target: toPhone,
    meta: {
      type: 'subscription_transfer',
      from_phone: fromPhone,
      from_user_id: fromUser.id,
      to_phone: toPhone,
      to_user_id: toUser.id,
      subscription_id: subscription.id,
      plan_name: subscription.plan_name,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
    },
  })

  revalidatePath('/admin/transfer-subscription')
  revalidatePath('/admin/activation-links')
  revalidatePath('/app/me')

  return {
    ok: true,
    details: `Подписка (${subscription.plan_name}, до ${subscription.end_date}) перенесена с ${fromPhone} на ${toPhone}.`,
  }
}

export async function previewTransfer(formData: FormData) {
  await requireAdmin()

  const fromPhoneRaw = String(formData.get('from_phone') ?? '').trim()
  const toPhoneRaw = String(formData.get('to_phone') ?? '').trim()

  const fromPhone = normalizePhoneToE164(fromPhoneRaw)
  const toPhone = normalizePhoneToE164(toPhoneRaw)

  if (!fromPhone) return { ok: false as const, error: 'Некорректный номер отправителя.' }
  if (!toPhone) return { ok: false as const, error: 'Некорректный номер получателя.' }
  if (fromPhone === toPhone) return { ok: false as const, error: 'Номера совпадают.' }

  const fromUser = await findUserByPhone(fromPhone)
  if (!fromUser) return { ok: false as const, error: `Пользователь ${fromPhone} не найден.` }

  const admin = createSupabaseAdminClient()

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id, status, plan_name, start_date, end_date')
    .eq('user_id', fromUser.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscription) return { ok: false as const, error: `У ${fromPhone} нет активной подписки.` }

  const toUser = await findUserByPhone(toPhone)

  return {
    ok: true as const,
    fromPhone,
    toPhone,
    fromUserId: fromUser.id,
    toUserExists: !!toUser,
    toUserId: toUser?.id ?? null,
    plan: subscription.plan_name,
    startDate: subscription.start_date,
    endDate: subscription.end_date,
  }
}
