'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { DEFAULT_OFFER_COOLDOWN_DAYS } from '@/lib/offers'

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  if (value == null) return null
  const stringValue = String(value).trim()
  if (!stringValue) return null
  const parsed = Number.parseInt(stringValue, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function sanitizeEstimatedValue(value: FormDataEntryValue | null): number | null {
  const parsed = parseOptionalInteger(value)
  if (parsed == null) return null
  return parsed < 0 ? 0 : parsed
}

function sanitizeCooldownDays(value: FormDataEntryValue | null): number {
  const parsed = parseOptionalInteger(value)
  if (parsed == null) return DEFAULT_OFFER_COOLDOWN_DAYS
  if (parsed < 1) return 1
  if (parsed > 365) return 365
  return parsed
}

export async function createOffer(formData: FormData) {
  const { supabase } = await requireAdmin()

  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!restaurantId) throw new Error('Missing restaurant_id')

  const payload = {
    restaurant_id: restaurantId,
    offer_type: String(formData.get('offer_type') || '2for1'),
    offer_key: String(formData.get('offer_key') || ''),
    offer_title: String(formData.get('offer_title') || ''),
    offer_terms_short: String(formData.get('offer_terms_short') || ''),
    offer_terms_full: '',
    estimated_value: sanitizeEstimatedValue(formData.get('estimated_value')),
    cooldown_days: sanitizeCooldownDays(formData.get('cooldown_days')),
    requires_main_course: false,
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('offers').insert(payload)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/offers/${restaurantId}`)
  redirect(`/admin/offers/${restaurantId}`)
}

export async function updateOffer(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = String(formData.get('id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!id || !restaurantId) throw new Error('Missing id or restaurant_id')

  const payload = {
    offer_type: String(formData.get('offer_type') || '2for1'),
    offer_key: String(formData.get('offer_key') || ''),
    offer_title: String(formData.get('offer_title') || ''),
    offer_terms_short: String(formData.get('offer_terms_short') || ''),
    offer_terms_full: '',
    estimated_value: sanitizeEstimatedValue(formData.get('estimated_value')),
    cooldown_days: sanitizeCooldownDays(formData.get('cooldown_days')),
    requires_main_course: false,
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('offers').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/offers/${restaurantId}`)
  redirect(`/admin/offers/${restaurantId}`)
}