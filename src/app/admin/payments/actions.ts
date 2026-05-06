'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

async function ensureAdmin() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden')
  }

  return { adminUserId: user.id }
}

type PaymentRequestRow = {
  id: string
  user_id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
}

async function fetchPaymentRequestOrThrow(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  paymentRequestId: string
): Promise<PaymentRequestRow> {
  const { data, error } = await admin
    .from('payment_requests')
    .select('id, user_id, amount, status')
    .eq('id', paymentRequestId)
    .single<PaymentRequestRow>()

  if (error || !data) {
    throw new Error('Заявка не найдена.')
  }
  return data
}

async function insertPaymentAudit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  args: {
    event_type: 'approve' | 'reject' | 'amount_edit'
    payment_request_id: string
    actor_user_id: string
    details?: Record<string, unknown> | null
  }
) {
  const { error } = await admin.from('payment_admin_audit').insert({
    event_type: args.event_type,
    payment_request_id: args.payment_request_id,
    actor_user_id: args.actor_user_id,
    details: args.details ?? null,
  })
  if (error) {
    // Audit failure should not silently unblock financial actions; surface for investigation.
    throw new Error(`Audit log failed: ${error.message}`)
  }
}

export async function approvePaymentRequest(formData: FormData) {
  const paymentRequestId = String(formData.get('paymentRequestId') ?? '').trim()

  if (!paymentRequestId) {
    throw new Error('Не указан ID заявки.')
  }

  const { adminUserId } = await ensureAdmin()
  const admin = createSupabaseAdminClient()

  const paymentRequest = await fetchPaymentRequestOrThrow(admin, paymentRequestId)

  if (paymentRequest.status !== 'pending') {
    throw new Error('Заявка уже обработана.')
  }

  const userId = paymentRequest.user_id
  const amount = Number(paymentRequest.amount)

  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 30)

  const startDateString = today.toISOString().slice(0, 10)
  const endDateString = endDate.toISOString().slice(0, 10)

  const { data: updatedPayment, error: paymentUpdateError } = await admin
    .from('payment_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_comment: `Approved manually. Amount: ${amount}`,
    })
    .eq('id', paymentRequestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (paymentUpdateError) {
    throw new Error(paymentUpdateError.message)
  }
  if (!updatedPayment) {
    throw new Error('Заявка уже обработана.')
  }

  const { data: existingSubscription } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSubscription?.id) {
    const { error: subscriptionUpdateError } = await admin
      .from('subscriptions')
      .update({
        status: 'active',
        plan_name: 'monthly_almaty',
        start_date: startDateString,
        end_date: endDateString,
        payment_request_id: paymentRequestId,
      })
      .eq('id', existingSubscription.id)

    if (subscriptionUpdateError) {
      throw new Error(subscriptionUpdateError.message)
    }
  } else {
    const { error: subscriptionInsertError } = await admin.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      plan_name: 'monthly_almaty',
      start_date: startDateString,
      end_date: endDateString,
      payment_request_id: paymentRequestId,
    })

    if (subscriptionInsertError) {
      throw new Error(subscriptionInsertError.message)
    }
  }

  await insertPaymentAudit(admin, {
    event_type: 'approve',
    payment_request_id: paymentRequestId,
    actor_user_id: adminUserId,
    details: { amount },
  })

  revalidatePath('/admin/payments')
  revalidatePath('/app/me')
}

export async function rejectPaymentRequest(formData: FormData) {
  const paymentRequestId = String(formData.get('paymentRequestId') ?? '').trim()

  if (!paymentRequestId) {
    throw new Error('Не указан ID заявки.')
  }

  const { adminUserId } = await ensureAdmin()
  const admin = createSupabaseAdminClient()

  const paymentRequest = await fetchPaymentRequestOrThrow(admin, paymentRequestId)

  if (paymentRequest.status !== 'pending') {
    throw new Error('Заявка уже обработана.')
  }

  const { data: rejectedRow, error } = await admin
    .from('payment_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_comment: 'Rejected manually',
    })
    .eq('id', paymentRequestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!rejectedRow) {
    throw new Error('Заявка уже обработана.')
  }

  await insertPaymentAudit(admin, {
    event_type: 'reject',
    payment_request_id: paymentRequestId,
    actor_user_id: adminUserId,
    details: null,
  })

  revalidatePath('/admin/payments')
  revalidatePath('/app/me')
}

/** Явное изменение суммы до подтверждения; пишет audit amount_edit. */
export async function editPaymentRequestAmount(formData: FormData) {
  const paymentRequestId = String(formData.get('paymentRequestId') ?? '').trim()
  const newAmountRaw = formData.get('newAmount')
  const newAmount =
    typeof newAmountRaw === 'string'
      ? Number(newAmountRaw.replace(',', '.'))
      : Number(newAmountRaw)

  if (!paymentRequestId) {
    throw new Error('Не указан ID заявки.')
  }
  if (!Number.isFinite(newAmount) || newAmount <= 0 || !Number.isInteger(newAmount)) {
    throw new Error('Укажите корректную сумму в тенге (целое число > 0).')
  }

  const { adminUserId } = await ensureAdmin()
  const admin = createSupabaseAdminClient()

  const paymentRequest = await fetchPaymentRequestOrThrow(admin, paymentRequestId)

  if (paymentRequest.status !== 'pending') {
    throw new Error('Можно менять сумму только у необработанной заявки.')
  }

  const previousAmount = Number(paymentRequest.amount)

  if (previousAmount === newAmount) {
    return
  }

  const { data: amountUpdated, error } = await admin
    .from('payment_requests')
    .update({ amount: newAmount })
    .eq('id', paymentRequestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!amountUpdated) {
    throw new Error('Заявка уже обработана.')
  }

  await insertPaymentAudit(admin, {
    event_type: 'amount_edit',
    payment_request_id: paymentRequestId,
    actor_user_id: adminUserId,
    details: { previous_amount: previousAmount, new_amount: newAmount },
  })

  revalidatePath('/admin/payments')
}
