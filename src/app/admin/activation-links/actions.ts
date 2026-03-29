'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { normalizePhoneToE164 } from '@/lib/auth/whatsapp-login'
import { generateHashedActivationToken } from '@/lib/activation-links'

export async function createActivationLink(formData: FormData) {
  const { supabase } = await requireAdmin()

  const phoneRaw = String(formData.get('phone_target') ?? '').trim()
  const amountRaw = Number(formData.get('amount'))
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.floor(amountRaw) : 4990

  const phoneTarget = normalizePhoneToE164(phoneRaw)
  if (!phoneTarget) {
    throw new Error('Укажите номер в формате +7…')
  }

  const token = generateHashedActivationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('activation_links').insert({
    token,
    phone_target: phoneTarget,
    amount,
    currency: 'KZT',
    status: 'issued',
    expires_at: expiresAt,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/activation-links')
}
