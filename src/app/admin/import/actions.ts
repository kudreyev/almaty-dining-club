'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

type Row = Record<string, string>

function parseBoolean(value: string | undefined, defaultValue = false) {
  if (value == null || value === '') return defaultValue
  const v = value.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'on'
}

/**
 * Достаточно надёжный CSV parser для:
 * - запятая как разделитель
 * - поддержка кавычек "..."
 * - внутри кавычек запятые допустимы
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    current.push(field)
    field = ''
  }
  const pushRow = () => {
    // ignore empty last line
    if (current.length === 1 && current[0].trim() === '') return
    rows.push(current)
    current = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      // escaped quote
      field += '"'
      i++
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === ',') {
      pushField()
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      // handle CRLF
      if (char === '\r' && next === '\n') i++
      pushField()
      pushRow()
      continue
    }

    field += char
  }

  // last field/row
  pushField()
  pushRow()

  const headers = (rows.shift() || []).map((h) => h.trim())
  return { headers, rows }
}

function rowsToObjects(headers: string[], rows: string[][]): Row[] {
  return rows.map((r) => {
    const obj: Row = {}
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim()
    })
    return obj
  })
}

export async function importCsvText(formData: FormData) {
  const { supabase } = await requireAdmin()

  const csv = String(formData.get('csv') || '')
  if (!csv.trim()) redirect('/admin/import?error=empty_csv')

  const { headers, rows } = parseCsv(csv)
  if (!headers.length) redirect('/admin/import?error=no_headers')

  const objects = rowsToObjects(headers, rows)
  if (!objects.length) redirect('/admin/import?error=no_rows')

  let restaurantsUpserted = 0
  let offersInserted = 0
  let staffUpserted = 0

  for (const row of objects) {
    // skip if no slug/name
    const slug = row.slug
    const name = row.restaurant_name
    if (!slug || !name) continue

    // 1) Upsert restaurant by slug
    const restaurantPayload: any = {
      restaurant_name: name,
      slug,
      city: row.city || 'almaty',
      district: row.district || '',
      address: row.address || '',
      phone: row.phone || null,
      instagram_url: row.instagram_url || null,
      website_url: row.website_url || null,
      cuisine: row.cuisine || '',
      short_description: row.short_description || '',
      working_hours: row.working_hours || '',
      price_level: (row.price_level || 'mid') as 'low' | 'mid' | 'high',
      photo_1_url: row.photo_1_url || null,
      photo_2_url: row.photo_2_url || null,
      photo_3_url: row.photo_3_url || null,
      is_active: parseBoolean(row.is_active, true),
    }

    const { data: restaurantUpsert, error: restError } = await supabase
      .from('restaurants')
      .upsert(restaurantPayload, { onConflict: 'slug' })
      .select('id, slug')
      .single()

    if (restError || !restaurantUpsert?.id) {
      redirect(`/admin/import?error=restaurant_upsert_failed:${encodeURIComponent(restError?.message || slug)}`)
    }

    restaurantsUpserted++

    const restaurantId = restaurantUpsert.id

    // 2) Insert offer (1 row = 1 offer). Можно сделать upsert позже, если понадобится.
    const offerType = (row.offer_type || '2for1') as '2for1' | 'compliment'

    const offerPayload: any = {
      restaurant_id: restaurantId,
      offer_type: offerType,
      offer_title: row.offer_title || '',
      offer_terms_short: row.offer_terms_short || '',
      offer_terms_full: row.offer_terms_full || '',
      offer_days: row.offer_days || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      offer_time_from: row.offer_time_from || '12:00',
      offer_time_to: row.offer_time_to || '22:00',
      requires_main_course: parseBoolean(row.requires_main_course, offerType === 'compliment'),
      is_stackable_with_other_promos: parseBoolean(row.is_stackable_with_other_promos, false),
      is_active: parseBoolean(row.is_active, true),
    }

    // Если оффер пустой — пропустим
    if (offerPayload.offer_title && offerPayload.offer_terms_short) {
      const { error: offerError } = await supabase.from('offers').insert(offerPayload)
      if (offerError) {
        redirect(`/admin/import?error=offer_insert_failed:${encodeURIComponent(offerError.message)}`)
      }
      offersInserted++
    }

    // 3) Upsert staff (один на ресторан)
    const pin = row.staff_pin
    if (pin) {
      const staffName = row.staff_name || 'Администратор'
      const isActive = parseBoolean(row.is_active, true)

      const { data: existingStaff } = await supabase
        .from('staff_users')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .limit(1)
        .maybeSingle()

      if (existingStaff?.id) {
        const { error: staffUpdateError } = await supabase
          .from('staff_users')
          .update({ staff_name: staffName, pin_code: pin, is_active: isActive })
          .eq('id', existingStaff.id)

        if (staffUpdateError) {
          redirect(`/admin/import?error=staff_update_failed:${encodeURIComponent(staffUpdateError.message)}`)
        }
      } else {
        const { error: staffInsertError } = await supabase
          .from('staff_users')
          .insert({ restaurant_id: restaurantId, staff_name: staffName, pin_code: pin, is_active: isActive })

        if (staffInsertError) {
          redirect(`/admin/import?error=staff_insert_failed:${encodeURIComponent(staffInsertError.message)}`)
        }
      }

      staffUpserted++
    }
  }

  redirect(
    `/admin/import?ok=${encodeURIComponent(
      `restaurants=${restaurantsUpserted}, offers=${offersInserted}, staff=${staffUpserted}`
    )}`
  )
}