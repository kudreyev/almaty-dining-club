'use server'

import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { revalidateCatalogPaths } from '@/lib/revalidate-catalog'
import { DEFAULT_CITY, isCity } from '@/lib/cities'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

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

/** ASCII-only key — безопаснее для unique offer_key. */
function slugifyOfferKey(input: string): string {
  const ascii = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return ascii || 'set'
}

function venuePath(
  eventId: string,
  restaurantId: string,
  opts?: { error?: string; ok?: boolean; setId?: string },
) {
  const base = `/admin/events/${eventId}/venues/${restaurantId}`
  const qs = new URLSearchParams()
  if (opts?.error) qs.set('error', opts.error.slice(0, 280))
  if (opts?.ok) qs.set('ok', '1')
  if (opts?.setId) qs.set('set', opts.setId)
  const q = qs.toString()
  return q ? `${base}?${q}` : base
}

function eventPath(eventId: string, error?: string) {
  const base = `/admin/events/${eventId}`
  if (!error) return base
  return `${base}?error=${encodeURIComponent(error.slice(0, 280))}`
}

function explainDbError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('event_venues') || m.includes('pgrst205')) {
    return 'Нет таблицы event_venues. Прогоните в Supabase SQL: supabase/migrations/20261120140000_event_venues.sql'
  }
  if (m.includes('offer_type') || m.includes('offers_offer_type_check')) {
    return 'В БД ещё нет типа set. Прогоните supabase/migrations/20261117120000_festival_events.sql'
  }
  if (m.includes('event_id') || m.includes('offers_set_event_required')) {
    return 'Сет должен быть привязан к фестивалю (event_id). Прогоните festival_events миграцию.'
  }
  if (m.includes('price_kzt') || m.includes('menu_value_kzt') || m.includes('items')) {
    return 'В offers нет колонок сета. Прогоните supabase/migrations/20261117120000_festival_events.sql'
  }
  return message
}

async function ensureEventVenue(
  supabase: SupabaseClient,
  eventId: string,
  restaurantId: string,
): Promise<string | null> {
  const { error } = await supabase.from('event_venues').upsert(
    { event_id: eventId, restaurant_id: restaurantId },
    { onConflict: 'event_id,restaurant_id' },
  )
  return error ? explainDbError(error.message) : null
}

export async function createEvent(formData: FormData) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const name = String(formData.get('name') || '').trim()
  if (!name) redirect('/admin/events/new?error=' + encodeURIComponent('Укажите название фестиваля'))

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
    redirect('/admin/events/new?error=' + encodeURIComponent('Укажите даты начала и конца'))
  }

  const { data, error } = await supabase
    .from('events')
    .insert(payload)
    .select('id')
    .single<{ id: string }>()

  if (error || !data) {
    redirect('/admin/events/new?error=' + encodeURIComponent(explainDbError(error?.message || 'Не удалось создать')))
  }

  revalidateCatalogPaths()
  revalidatePath('/admin/events')
  redirect(`/admin/events/${data.id}`)
}

export async function updateEvent(formData: FormData) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/admin/events')

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
  if (error) redirect(eventPath(id, explainDbError(error.message)))

  revalidateCatalogPaths()
  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
  redirect(`/admin/events/${id}`)
}

export async function addFestivalRestaurant(formData: FormData) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const eventId = String(formData.get('event_id') || '')
  if (!eventId) redirect('/admin/events')

  const existingId = String(formData.get('restaurant_id') || '').trim()
  let restaurantId = existingId

  if (!restaurantId) {
    const name = String(formData.get('new_restaurant_name') || '').trim()
    const slug = String(formData.get('new_restaurant_slug') || '').trim() || slugify(name)
    if (!name) redirect(eventPath(eventId, 'Выберите заведение или создайте новое'))

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

    if (error || !created) {
      redirect(eventPath(eventId, explainDbError(error?.message || 'Не удалось создать заведение')))
    }
    restaurantId = created.id
  } else {
    const combine = formData.get('combine_set_with_club_offer') === 'on'
    await supabase
      .from('restaurants')
      .update({ combine_set_with_club_offer: combine })
      .eq('id', restaurantId)
  }

  const linkError = await ensureEventVenue(supabase, eventId, restaurantId)
  if (linkError) redirect(eventPath(eventId, linkError))

  revalidatePath(`/admin/events/${eventId}`)
  redirect(`/admin/events/${eventId}`)
}

export async function removeFestivalRestaurant(formData: FormData) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const eventId = String(formData.get('event_id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!eventId || !restaurantId) redirect('/admin/events')

  const { count } = await supabase
    .from('offers')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('restaurant_id', restaurantId)
    .eq('offer_type', 'set')

  if ((count ?? 0) > 0) {
    redirect(eventPath(eventId, 'Сначала удалите сеты этого заведения'))
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
  if (error) redirect(eventPath(eventId, explainDbError(error.message)))

  revalidatePath(`/admin/events/${eventId}`)
  redirect(`/admin/events/${eventId}`)
}

export async function saveFestivalSet(formData: FormData) {
  const eventId = String(formData.get('event_id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  try {
    await requireAdmin()
    const supabase = createSupabaseAdminClient()
    const offerId = String(formData.get('offer_id') || '').trim()
    if (!eventId || !restaurantId) redirect('/admin/events')

    const title = String(formData.get('offer_title') || '').trim()
    if (!title) {
      redirect(venuePath(eventId, restaurantId, { error: 'Укажите название сета' }))
    }

    const priceKzt = parseIntField(formData.get('price_kzt'), 3500)
    const menuValue = parseIntField(formData.get('menu_value_kzt'), priceKzt + 2000)
    const estimatedValue = Math.max(0, menuValue - priceKzt)

    let items: unknown = null
    const itemsRaw = String(formData.get('items_json') || '')
      .trim()
      .replace(/^\uFEFF/, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
    if (itemsRaw) {
      try {
        items = JSON.parse(itemsRaw)
      } catch {
        redirect(
          venuePath(eventId, restaurantId, {
            error: 'Состав сета: некорректный JSON. Можно очистить поле и сохранить без состава.',
          }),
        )
      }
    }

    const offerKey =
      String(formData.get('offer_key') || '').trim()
      || `set_${slugifyOfferKey(title)}_${Date.now().toString(36)}`

    const linkError = await ensureEventVenue(supabase, eventId, restaurantId)
    if (linkError) {
      redirect(venuePath(eventId, restaurantId, { error: linkError }))
    }

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
      if (error) {
        redirect(
          venuePath(eventId, restaurantId, {
            error: explainDbError(error.message),
            setId: offerId,
          }),
        )
      }
      revalidateCatalogPaths()
      revalidatePath(`/admin/events/${eventId}`)
      revalidatePath(`/admin/events/${eventId}/venues/${restaurantId}`)
      redirect(venuePath(eventId, restaurantId, { ok: true, setId: offerId }))
    }

    const { data: created, error } = await supabase
      .from('offers')
      .insert({
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
        takeaway_only: false,
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !created) {
      redirect(
        venuePath(eventId, restaurantId, {
          error: explainDbError(error?.message || 'Не удалось создать сет'),
        }),
      )
    }

    revalidateCatalogPaths()
    revalidatePath(`/admin/events/${eventId}`)
    revalidatePath(`/admin/events/${eventId}/venues/${restaurantId}`)
    redirect(venuePath(eventId, restaurantId, { ok: true }))
  } catch (e) {
    unstable_rethrow(e)
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка при сохранении сета'
    if (eventId && restaurantId) {
      redirect(venuePath(eventId, restaurantId, { error: explainDbError(message) }))
    }
    redirect('/admin/events?error=' + encodeURIComponent(explainDbError(message)))
  }
}

/** Расписание подачи — на уровне заведения (общее для всех его сетов). */
export async function saveFestivalVenueSchedule(formData: FormData) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const eventId = String(formData.get('event_id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!eventId || !restaurantId) redirect('/admin/events')

  const linkError = await ensureEventVenue(supabase, eventId, restaurantId)
  if (linkError) redirect(venuePath(eventId, restaurantId, { error: linkError }))

  try {
    await saveVenueSchedule(supabase, eventId, restaurantId, formData)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Не удалось сохранить расписание'
    redirect(venuePath(eventId, restaurantId, { error: explainDbError(message) }))
  }

  const combine = formData.get('combine_set_with_club_offer') === 'on'
  await supabase
    .from('restaurants')
    .update({ combine_set_with_club_offer: combine })
    .eq('id', restaurantId)

  revalidateCatalogPaths()
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/venues/${restaurantId}`)
  redirect(venuePath(eventId, restaurantId, { ok: true }))
}

export async function deleteFestivalSet(formData: FormData) {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const eventId = String(formData.get('event_id') || '')
  const restaurantId = String(formData.get('restaurant_id') || '')
  const offerId = String(formData.get('offer_id') || '')
  if (!eventId || !restaurantId || !offerId) redirect('/admin/events')

  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('id', offerId)
    .eq('event_id', eventId)
    .eq('restaurant_id', restaurantId)
    .eq('offer_type', 'set')
  if (error) {
    redirect(venuePath(eventId, restaurantId, { error: explainDbError(error.message) }))
  }

  revalidateCatalogPaths()
  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath(`/admin/events/${eventId}/venues/${restaurantId}`)
  redirect(venuePath(eventId, restaurantId, { ok: true }))
}

async function saveVenueSchedule(
  supabase: SupabaseClient,
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
