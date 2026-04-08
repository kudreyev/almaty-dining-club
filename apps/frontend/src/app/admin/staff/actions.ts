'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

export async function upsertRestaurantStaff(formData: FormData) {
  const { supabase } = await requireAdmin()

  const restaurantId = String(formData.get('restaurant_id') || '')
  const staffName = String(formData.get('staff_name') || 'Администратор').trim()
  const pinCode = String(formData.get('pin_code') || '').trim()
  const isActive = formData.get('is_active') === 'on'

  if (!restaurantId || !pinCode) {
    throw new Error('Missing restaurant_id or pin_code')
  }

  // Один staff на ресторан: ищем существующего
  const { data: existing } = await supabase
    .from('staff_users')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('staff_users')
      .update({
        staff_name: staffName,
        pin_code: pinCode,
        is_active: isActive,
      })
      .eq('id', existing.id)

    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('staff_users').insert({
      restaurant_id: restaurantId,
      staff_name: staffName,
      pin_code: pinCode,
      is_active: isActive,
    })

    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/staff')
  redirect('/admin/staff')
}