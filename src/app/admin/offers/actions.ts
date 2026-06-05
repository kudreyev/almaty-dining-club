'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { DEFAULT_OFFER_COOLDOWN_DAYS, type OfferUsableHour } from '@/lib/offers'
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

function sanitizeTime(value: FormDataEntryValue | null): string | null {
  if (value == null) return null
  const stringValue = String(value).trim()
  if (!stringValue) return null
  const match = stringValue.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parseOfferUsableHoursFromFormData(
  offerType: string,
  formData: FormData,
): OfferUsableHour[] | null {
  if (offerType !== 'kudafest_set') return null

  const hours: OfferUsableHour[] = []
  let anyConfigured = false

  for (let day = 1; day <= 7; day += 1) {
    const isUnavailable = formData.get(`offer_hours_${day}_is_unavailable`) === 'on'
    const toNextDayChecked = formData.get(`offer_hours_${day}_to_next_day`) === 'on'
    const from = sanitizeTime(formData.get(`offer_hours_${day}_from_time`))
    const to = sanitizeTime(formData.get(`offer_hours_${day}_to_time`))

    if (!isUnavailable && from && to) {
      const inferredToNextDay = to < from
      const toNextDay = toNextDayChecked || inferredToNextDay

      if (!toNextDay && to <= from) {
        throw new Error(
          `День ${day}: время окончания должно быть позже начала или включите «До следующего дня»`,
        )
      }
      if (toNextDay && to >= from) {
        throw new Error(
          `День ${day}: при закрытии на следующий день окончание должно быть раньше начала (например 22:00–01:00)`,
        )
      }
      if (from === to) {
        throw new Error(`День ${day}: время начала и окончания не может совпадать`)
      }

      anyConfigured = true
      hours.push({
        day_of_week: day,
        is_unavailable: false,
        from_time: from,
        to_time: to,
        to_next_day: toNextDay,
      })
      continue
    }

    if (!isUnavailable && (from || to)) {
      throw new Error(`День ${day}: укажите время начала и окончания или отметьте «недоступен»`)
    }

    hours.push({
      day_of_week: day,
      is_unavailable: true,
      from_time: null,
      to_time: null,
      to_next_day: false,
    })
  }

  return anyConfigured ? hours : null
}

async function replaceOfferUsableHours(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  offerId: string,
  hours: OfferUsableHour[] | null,
) {
  const { error: deleteError } = await supabase
    .from('offer_usable_hours')
    .delete()
    .eq('offer_id', offerId)

  if (deleteError) throw new Error(deleteError.message)
  if (!hours?.length) return

  const payload = hours.map((item) => ({
    offer_id: offerId,
    day_of_week: item.day_of_week,
    is_unavailable: item.is_unavailable,
    from_time: item.from_time,
    to_time: item.to_time,
    to_next_day: item.to_next_day ?? false,
  }))

  const { error: insertError } = await supabase.from('offer_usable_hours').insert(payload)
  if (insertError) throw new Error(insertError.message)
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
  const usableHours = parseOfferUsableHoursFromFormData(offerType, formData)

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

  const { data: inserted, error } = await supabase
    .from('offers')
    .insert(payload)
    .select('id')
    .single<{ id: string }>()

  if (error) throw new Error(error.message)

  await replaceOfferUsableHours(supabase, inserted.id, usableHours)

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

  const usableHours = parseOfferUsableHoursFromFormData(offerType, formData)

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

  await replaceOfferUsableHours(supabase, id, usableHours)

  revalidatePath(`/admin/offers/${restaurantId}`)
  redirect(`/admin/offers/${restaurantId}`)
}
