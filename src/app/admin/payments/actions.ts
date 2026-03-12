'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  return { supabase, adminUserId: user.id }
}

export async function approvePaymentRequest(formData: FormData) {
  const paymentRequestId = String(formData.get('paymentRequestId') || '')
  const userId = String(formData.get('userId') || '')
  const amount = Number(formData.get('amount') || 0)

  if (!paymentRequestId || !userId) {
    throw new Error('Missing required fields')
  }

  const { supabase, adminUserId } = await ensureAdmin()

  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 30)

  const startDateString = today.toISOString().slice(0, 10)
  const endDateString = endDate.toISOString().slice(0, 10)

  const { error: paymentUpdateError } = await supabase
    .from('payment_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_comment: `Approved manually. Amount: ${amount}`,
    })
    .eq('id', paymentRequestId)

  if (paymentUpdateError) {
    throw new Error(paymentUpdateError.message)
  }

  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSubscription?.id) {
    const { error: subscriptionUpdateError } = await supabase
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
    const { error: subscriptionInsertError } = await supabase
      .from('subscriptions')
      .insert({
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

  revalidatePath('/admin/payments')
  revalidatePath('/app/me')
}

export async function rejectPaymentRequest(formData: FormData) {
  const paymentRequestId = String(formData.get('paymentRequestId') || '')

  if (!paymentRequestId) {
    throw new Error('Missing paymentRequestId')
  }

  const { supabase, adminUserId } = await ensureAdmin()

  const { error } = await supabase
    .from('payment_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_comment: 'Rejected manually',
    })
    .eq('id', paymentRequestId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/payments')
  revalidatePath('/app/me')
}