'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { revalidateCatalogPaths } from '@/lib/revalidate-catalog'
import { DEFAULT_CITY, isCity } from '@/lib/cities'

function parseCity(value: FormDataEntryValue | null): 'almaty' | 'astana' {
  return isCity(value) ? value : DEFAULT_CITY
}

function parseIntField(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(String(value || '').trim())
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'event'
}

export async function createEvent(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = String(formData.get('name') || '').trim()
  if (!name) throw new Error('Укажите название фестиваля')

  const slugRaw = String(formData.get('slug') || '').trim() || slugify(name)
  const payload = {
    name,
    slug: slugRaw,
    city: parseCity(formData.get('city')),
    starts_at: String(formData.get('starts_at') || ''),
    ends_at: String(formData.get('ends_at') || ''),
    set_price_kzt: parseIntField(formData.get('set_price_kzt'), 3500),
    accent_color: String(formData.get('accent_color') || '#5B21B6').trim() || '#5B21B6',
    logo_url: String(formData.get('logo_url') || '').trim() || null,
    is_published: formData.get('is_published') === 'on',
    max_sets_per_venue_per_day: Math.max(1, parseIntField(formData.get('max_sets_per_venue_per_day'), 1)),
  }

  if (!payload.starts_at || !payload.ends_at) {
    throw new Error('Укажите даты начала и конца')
  }

  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select('id')
    .single<{ id: string }>()

  if (error) throw new Error(error.message)

  revalidateCatalogPaths()
  revalidatePath('/admin/events')
  redirect(`/admin/events/${data.id}`)
}

export async function updateEvent(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')

  const payload = {
    name: String(formData.get('name') || '').trim(),
    slug: String(formData.get('slug') || '').trim(),
    city: parseCity(formData.get('city')),
    starts_at: String(formData.get('starts_at') || ''),
    ends_at: String(formData.get('ends_at') || ''),
    set_price_kzt: parseIntField(formData.get('set_price_kzt'), 3500),
    accent_color: String(formData.get('accent_color') || '#5B21B6').trim() || '#5B21B6',
    logo_url: String(formData.get('logo_url') || '').trim() || null,
    is_published: formData.get('is_published') === 'on',
    max_sets_per_venue_per_day: Math.max(1, parseIntField(formData.get('max_sets_per_venue_per_day'), 1)),
  }

  const { error } = await supabase.from('events').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidateCatalogPaths()
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
  redirect(`/admin/events/${id}`)
}

export async function addFestivalRestaurant(formData: FormData) {
  const { supabase } = await requireAdmin()
  const eventId = String(formData.get('event_id') || '')
  if (!eventId) throw new Error('Missing event_id')

  const existingId = String(formData.get('restaurant_id') || '').trim()
  let restaurantId = existingId

  if (!restaurantId) {
    const name = String(formData.get('new_restaurant_name') || '').trim()
    const slug = String(formData.get('new_restaurant_slug') || '').trim() || slugify(name)
    if (!name) throw new Error('Выберите заведение или создайте новое')

    const { data: event } = await supabase
      .from('events')
      .select('city')
      .eq('id', eventId)
      .single<{ city: 'almaty' | 'astana' }>()

    const { data: created, error } = await supabase
      .from('restaurants')
      .insert({
        restaurant_name: name,
        slug,
        city: event?.city ?? DEFAULT_CITY,
        address: String(formData.get('new_restaurant_address') || '—'),
        cuisine: String(formData.get('new_restaurant_cuisine') || 'Кофейня'),
        is_active: true,
        combine_set_with_club_offer: formData.get('combine_set_with_club_offer') === 'on',
      })
      .select('id')
      .single<{ id: string }>()

    if (error) throw new Error(error.message)
    restaurantId = created.id
  } else {
    const combine = formData.get('combine_set_with_club_offer') === 'on'
    await supabase
      .from('restaurants')
      .update({ combine_set_with_club_offer: combine })
      .eq('id', restaurantId)
  }

  const { error: linkError } = await supabase.from('event_venues').upsert(
    { event_id: eventId, restaurant_id: restaurantId },
    { onConflict: 'event_id,restaurant_id' },
  )
  if (linkError) throw new Error(linkError.message)

  revalidatePath(`/admin/events/${eventId}`)
  // Остаёмся на странице фестиваля — сет прикрепляется отдельно.
  redirect(`/admin/events/${eventId}`)
}

export async function removeFestivalRestaurant(formData: FormData) {
  const { supabase } = await requireAdmin()
  const eventId = String(formData.get('event_id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!eventId || !restaurantId) throw new Error('Missing ids')

  const { count } = await supabase
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('restaurant_id', restaurantId)
    .eq('offer_type', 'set')

  if ((count ?? 0) > 0) {
    throw new Error('Сначала удалите или отвяжите сеты этого заведения')
  }

  await supabase
    .from('event_venue_schedule')
    .delete()
    .eq('event_id', eventId)
    .eq('restaurant_id', restaurantId)

  const { error } = await supabase
    .from('event_venues')
    .delete()
    .eq('event_id', eventId)
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/events/${eventId}`)
  redirect(`/admin/events/${eventId}`)
}

export async function saveFestivalSet(formData: FormData) {
  const { supabase } = await requireAdmin()
  const eventId = String(formData.get('event_id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  const offerId = String(formData.get('offer_id') || '').trim()
  if (!eventId || !restaurantId) throw new Error('Missing ids')

  const title = String(formData.get('offer_title') || '').trim()
  if (!title) throw new Error('Укажите название сета')

  const priceKzt = parseIntField(formData.get('price_kzt'), 3500)
  const menuValue = parseIntField(formData.get('menu_value_kzt'), priceKzt + 2000)
  const estimatedValue = Math.max(0, menuValue - priceKzt)

  let items: unknown = null
  const itemsRaw = String(formData.get('items_json') || '').trim()
  if (itemsRaw) {
    try {
      items = JSON.parse(itemsRaw)
    } catch {
      throw new Error('Состав сета: некорректный JSON')
    }
  }

  const offerKey =
    String(formData.get('offer_key') || '').trim()
    || `set_${slugify(title)}_${Date.now().toString(36)}`

  // Сет можно прикрепить только к площадке фестиваля.
  const { error: linkError } = await supabase.from('event_venues').upsert(
    { event_id: eventId, restaurant_id: restaurantId },
    { onConflict: 'event_id,restaurant_id' },
  )
  if (linkError) throw new Error(linkError.message)

  if (offerId) {
    const { error } = await supabase
      .from('offers')
      .update({
        offer_title: title,
        offer_terms_short: String(formData.get('offer_terms_short') || ''),
        price_kzt: priceKzt,
        menu_value_kzt: menuValue,
        estimated_value: estimatedValue,
        items,
        is_active: formData.get('is_active') === 'on',
      })
      .eq('id', offerId)
      .eq('restaurant_id', restaurantId)
      .eq('event_id', eventId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('offers').insert({
      restaurant_id: restaurantId,
      event_id: eventId,
      offer_type: 'set',
      offer_key: offerKey,
      offer_title: title,
      offer_terms_short: String(formData.get('offer_terms_short') || ''),
      offer_terms_full: '',
      price_kzt: priceKzt,
      menu_value_kzt: menuValue,
      estimated_value: estimatedValue,
      items,
      is_active: formData.get('is_active') === 'on',
    })
    if (error) throw new Error(error.message)
  }

  await saveVenueSchedule(supabase, eventId, restaurantId, formData)

  const combine = formData.get('combine_set_with_club_offer') === 'on'
  await supabase
    .from('restaurants')
    .update({ combine_set_with_club_offer: combine })
    .eq('id', restaurantId)

  revalidateCatalogPaths()
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/venues/${restaurantId}`)
  redirect(`/admin/events/${eventId}/venues/${restaurantId}`)
}

async function saveVenueSchedule(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  eventId: string,
  restaurantId: string,
  formData: FormData,
) {
  const rows: Array<{
    event_id: string
    restaurant_id: string
    offer_id: null
    weekday: number
    open_time: string
    close_time: string
  }> = []

  for (let day = 1; day <= 7; day += 1) {
    const closed = formData.get(`sched_${day}_closed`) === 'on'
    if (closed) continue
    const open = String(formData.get(`sched_${day}_open`) || '').trim()
    const close = String(formData.get(`sched_${day}_close`) || '').trim()
    if (!open || !close) continue
    rows.push({
      event_id: eventId,
      restaurant_id: restaurantId,
      offer_id: null,
      weekday: day,
      open_time: open,
      close_time: close,
    })

    const open2 = String(formData.get(`sched_${day}_open2`) || '').trim()
    const close2 = String(formData.get(`sched_${day}_close2`) || '').trim()
    if (open2 && close2) {
      rows.push({
        event_id: eventId,
        restaurant_id: restaurantId,
        offer_id: null,
        weekday: day,
        open_time: open2,
        close_time: close2,
      })
    }
  }

  await supabase
    .from('event_venue_schedule')
    .delete()
    .eq('event_id', eventId)
    .eq('restaurant_id', restaurantId)
    .is('offer_id', null)

  if (rows.length > 0) {
    const { error } = await supabase.from('event_venue_schedule').insert(rows)
    if (error) throw new Error(error.message)
  }
}
