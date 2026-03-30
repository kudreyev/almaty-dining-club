'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { normalizeToE164Like } from '@/lib/kz-phone'
import { generateHashedActivationToken } from '@/lib/activation-links'
import { logAnalyticsEvent } from '@/lib/analytics'

export async function createActivationLink(formData: FormData) {
  const { supabase } = await requireAdmin()

  const phoneRaw = String(formData.get('phone_target') ?? '').trim()
  const amountRaw = Number(formData.get('amount'))
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.floor(amountRaw) : 4990

  const phoneTarget = normalizeToE164Like(phoneRaw)
  if (!phoneTarget) {
    redirect('/admin/activation-links?error=invalid_phone')
  }

  const token = generateHashedActivationToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: inserted, error } = await supabase
    .from('activation_links')
    .insert({
      token,
      phone_target: phoneTarget,
      amount,
      currency: 'KZT',
      status: 'issued',
      expires_at: expiresAt,
    })
    .select('id, token, phone_target')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await logAnalyticsEvent({
    event_name: 'activation_link_created',
    activation_link_id: inserted?.id ?? null,
    token: inserted?.token ?? token,
    phone_target: inserted?.phone_target ?? phoneTarget,
    meta: { amount, source: 'admin' },
  })

  revalidatePath('/admin/activation-links')
}
