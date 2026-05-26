'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { DEFAULT_OFFER_COOLDOWN_DAYS } from '@/lib/offers'
import { buildOfferKeyBase } from '@/lib/offer-key'

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

function sanitizeEndDate(value: FormDataEntryValue | null): string | null {
  if (value == null) return null
  const stringValue = String(value).trim()
  if (!stringValue) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return null
  return stringValue
}

async function generateUniqueOfferKey(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  restaurantId: string,
  offerTitle: string,
  offerType: string
): Promise<string> {
  const baseKey = buildOfferKeyBase(offerTitle, offerType)
  let candidate = baseKey
  let index = 2

  while (true) {
    const { data: existing, error } = await supabase
      .from('offers')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('offer_key', candidate)
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (error) throw new Error(error.message)
    if (!existing) return candidate

    candidate = `${baseKey}_${index}`
    index += 1
  }
}

export async function createOffer(formData: FormData) {
  const { supabase } = await requireAdmin()

  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!restaurantId) throw new Error('Missing restaurant_id')
  const offerType = String(formData.get('offer_type') || '2for1')
  const offerTitle = String(formData.get('offer_title') || '').trim()
  if (!offerTitle) throw new Error('Название предложения обязательно')
  const endDate = sanitizeEndDate(formData.get('end_date'))
  if (offerType === 'kudafest_set' && !endDate) {
    throw new Error('Для оффера Kudafest укажите дату окончания')
  }
  const providedOfferKey = String(formData.get('offer_key') || '').trim()
  const offerKey = providedOfferKey || await generateUniqueOfferKey(supabase, restaurantId, offerTitle, offerType)

  const payload = {
    restaurant_id: restaurantId,
    offer_type: offerType,
    offer_key: offerKey,
    offer_title: offerTitle,
    offer_terms_short: String(formData.get('offer_terms_short') || ''),
    offer_terms_full: '',
    estimated_value: sanitizeEstimatedValue(formData.get('estimated_value')),
    cooldown_days: sanitizeCooldownDays(formData.get('cooldown_days')),
    end_date: endDate,
    dish_photo_url: String(formData.get('dish_photo_url') || '').trim() || null,
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
  const offerType = String(formData.get('offer_type') || '2for1')
  const offerTitle = String(formData.get('offer_title') || '').trim()
  if (!offerTitle) throw new Error('Название предложения обязательно')
  const endDate = sanitizeEndDate(formData.get('end_date'))
  if (offerType === 'kudafest_set' && !endDate) {
    throw new Error('Для оффера Kudafest укажите дату окончания')
  }

  const { data: existingOffer, error: existingOfferError } = await supabase
    .from('offers')
    .select('offer_key')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .single<{ offer_key: string | null }>()

  if (existingOfferError) throw new Error(existingOfferError.message)

  const incomingOfferKey = String(formData.get('offer_key') || '').trim()
  const offerKey =
    existingOffer?.offer_key?.trim()
      || incomingOfferKey
      || await generateUniqueOfferKey(supabase, restaurantId, offerTitle, offerType)

  const payload = {
    offer_type: offerType,
    offer_key: offerKey,
    offer_title: offerTitle,
    offer_terms_short: String(formData.get('offer_terms_short') || ''),
    offer_terms_full: '',
    estimated_value: sanitizeEstimatedValue(formData.get('estimated_value')),
    cooldown_days: sanitizeCooldownDays(formData.get('cooldown_days')),
    end_date: endDate,
    dish_photo_url: String(formData.get('dish_photo_url') || '').trim() || null,
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('offers').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/offers/${restaurantId}`)
  redirect(`/admin/offers/${restaurantId}`)
}