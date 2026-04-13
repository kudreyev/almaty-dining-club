'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { normalizeKZPhone } from '@/lib/kz-phone'
import {
  createRestaurantViaApi,
  updateRestaurantViaApi,
  type RestaurantPayload,
} from '@/lib/restaurants-api'
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

function parseOptionalCoordinate(value: FormDataEntryValue | null): number | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = Number(raw.replace(',', '.'))
  if (!Number.isFinite(parsed)) {
    throw new Error('Координаты должны быть числом.')
  }
  return parsed
}

function buildRestaurantPayload(formData: FormData): RestaurantPayload {
  const phoneRaw = String(formData.get('phone') || '').trim()
  const phoneNormalized = phoneRaw ? normalizeKZPhone(phoneRaw) : null

  return {
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
    is_active: formData.get('is_active') === 'on',
    hours: parseRestaurantHoursFromFormData(formData),
  }
}

export async function createRestaurant(formData: FormData) {
  await requireAdmin()

  const payload = buildRestaurantPayload(formData)
  await createRestaurantViaApi(payload)

  revalidatePath('/')
  revalidatePath('/almaty')
  revalidatePath('/admin/restaurants')
  redirect('/admin/restaurants')
}

export async function updateRestaurant(formData: FormData) {
  await requireAdmin()

  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')

  const lat = parseOptionalCoordinate(formData.get('lat'))
  const lng = parseOptionalCoordinate(formData.get('lng'))

  if ((lat == null) !== (lng == null)) {
    throw new Error('Заполните одновременно широту и долготу или оставьте оба поля пустыми.')
  }

  if (lat != null && (lat < -90 || lat > 90)) {
    throw new Error('Широта должна быть в диапазоне от -90 до 90.')
  }
  if (lng != null && (lng < -180 || lng > 180)) {
    throw new Error('Долгота должна быть в диапазоне от -180 до 180.')
  }

  const payload = { ...buildRestaurantPayload(formData), lat, lng }
  await updateRestaurantViaApi(id, payload)

  revalidatePath('/')
  revalidatePath('/almaty')
  revalidatePath('/map')
  revalidatePath(`/r/${payload.slug}`)
  revalidatePath('/admin/restaurants')
  revalidatePath(`/r/`)
  redirect('/admin/restaurants')
}
