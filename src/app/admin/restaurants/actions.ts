'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { normalizeKZPhone } from '@/lib/kz-phone'
import type { RestaurantHour } from '@/lib/opening-hours'

function minutesFromTime(value: string): number {
  const [hh, mm] = value.split(':').map((part) => Number(part))
  return hh * 60 + mm
}

function parseRestaurantHoursFromFormData(formData: FormData): RestaurantHour[] {
  const hours: RestaurantHour[] = []

  for (let day = 1; day <= 7; day += 1) {
    const isClosedChecked = formData.get(`hours_${day}_is_closed`) === 'on'
    const closeNextDayChecked = formData.get(`hours_${day}_close_next_day`) === 'on'
    const openTimeRaw = String(formData.get(`hours_${day}_open_time`) || '').trim()
    const closeTimeRaw = String(formData.get(`hours_${day}_close_time`) || '').trim()

    const isClosed = isClosedChecked

    if (!isClosed && (!openTimeRaw || !closeTimeRaw)) {
      throw new Error(`День ${day}: укажите время открытия и закрытия или отметьте «выходной».`)
    }

    const openMinutes = openTimeRaw ? minutesFromTime(openTimeRaw) : 0
    const closeMinutes = closeTimeRaw ? minutesFromTime(closeTimeRaw) : 0
    const inferredCloseNextDay = !isClosed && closeMinutes < openMinutes
    const closeNextDay = isClosed ? false : closeNextDayChecked || inferredCloseNextDay

    if (!isClosed && !closeNextDay && closeMinutes <= openMinutes) {
      throw new Error(`День ${day}: время закрытия должно быть позже открытия или включите «Закрытие на следующий день».`)
    }

    if (!isClosed && closeMinutes === openMinutes) {
      throw new Error(`День ${day}: время открытия и закрытия не может совпадать.`)
    }

    hours.push({
      day_of_week: day,
      is_closed: isClosed,
      open_time: isClosed ? null : openTimeRaw,
      close_time: isClosed ? null : closeTimeRaw,
      close_next_day: closeNextDay,
    })
  }

  return hours
}

async function replaceRestaurantHours(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  restaurantId: string,
  hours: RestaurantHour[]
) {
  const { error: deleteError } = await supabase
    .from('restaurant_hours')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) throw new Error(deleteError.message)

  const payload = hours.map((item) => ({
    restaurant_id: restaurantId,
    day_of_week: item.day_of_week,
    is_closed: item.is_closed,
    open_time: item.open_time,
    close_time: item.close_time,
    close_next_day: item.close_next_day ?? false,
  }))

  const { error: insertError } = await supabase
    .from('restaurant_hours')
    .insert(payload)

  if (insertError) throw new Error(insertError.message)
}

export async function createRestaurant(formData: FormData) {
  const { supabase } = await requireAdmin()
  const restaurantHours = parseRestaurantHoursFromFormData(formData)

  const phoneRaw = String(formData.get('phone') || '').trim()
  const phoneNormalized = phoneRaw ? normalizeKZPhone(phoneRaw) : null

  const payload = {
    restaurant_name: String(formData.get('restaurant_name') || ''),
    slug: String(formData.get('slug') || ''),
    city: 'almaty',
    address: String(formData.get('address') || ''),
    phone: phoneNormalized,
    instagram_url: String(formData.get('instagram_url') || '') || null,
    website_url: String(formData.get('website_url') || '') || null,
    two_gis_url: String(formData.get('two_gis_url') || '') || null,
    cuisine: String(formData.get('cuisine') || ''),
    cuisine_2: String(formData.get('cuisine_2') || '') || null,
    cuisine_3: String(formData.get('cuisine_3') || '') || null,
    short_description: String(formData.get('short_description') || ''),
    photo_1_url: String(formData.get('photo_1_url') || '') || null,
    photo_2_url: String(formData.get('photo_2_url') || '') || null,
    photo_3_url: String(formData.get('photo_3_url') || '') || null,
    is_active: formData.get('is_active') === 'on',
  }

  const { data: createdRestaurant, error } = await supabase
    .from('restaurants')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  if (!createdRestaurant?.id) throw new Error('Не удалось определить id заведения после создания')

  await replaceRestaurantHours(supabase, createdRestaurant.id, restaurantHours)

  revalidatePath('/')
  revalidatePath('/almaty')
  revalidatePath('/admin/restaurants')
  redirect('/admin/restaurants')
}

export async function updateRestaurant(formData: FormData) {
  const { supabase } = await requireAdmin()
  const restaurantHours = parseRestaurantHoursFromFormData(formData)

  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')

  const phoneRaw = String(formData.get('phone') || '').trim()
  const phoneNormalized = phoneRaw ? normalizeKZPhone(phoneRaw) : null

  const payload = {
    restaurant_name: String(formData.get('restaurant_name') || ''),
    slug: String(formData.get('slug') || ''),
    address: String(formData.get('address') || ''),
    phone: phoneNormalized,
    instagram_url: String(formData.get('instagram_url') || '') || null,
    website_url: String(formData.get('website_url') || '') || null,
    two_gis_url: String(formData.get('two_gis_url') || '') || null,
    cuisine: String(formData.get('cuisine') || ''),
    cuisine_2: String(formData.get('cuisine_2') || '') || null,
    cuisine_3: String(formData.get('cuisine_3') || '') || null,
    short_description: String(formData.get('short_description') || ''),
    photo_1_url: String(formData.get('photo_1_url') || '') || null,
    photo_2_url: String(formData.get('photo_2_url') || '') || null,
    photo_3_url: String(formData.get('photo_3_url') || '') || null,
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('restaurants').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  await replaceRestaurantHours(supabase, id, restaurantHours)

  revalidatePath('/')
  revalidatePath('/almaty')
  revalidatePath(`/r/${payload.slug}`)
  revalidatePath('/admin/restaurants')
  revalidatePath(`/r/`)
  redirect('/admin/restaurants')
}