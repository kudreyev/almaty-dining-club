'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { setStaffSession, clearStaffSession } from '@/lib/staff-session'

function toQuery(value: string) {
  return encodeURIComponent(value)
}

export async function loginStaff(formData: FormData) {
  const restaurantId = String(formData.get('restaurantId') || '').trim()
  const pinCode = String(formData.get('pinCode') || '').trim()

  if (!restaurantId || !pinCode) {
    redirect('/staff/login?error=missing_fields')
  }

  const supabase = await createSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from('staff_users')
    .select('id, restaurant_id, pin_code, is_active')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .limit(10)

  if (error) {
    redirect(`/staff/login?error=db_error&message=${toQuery(error.message)}`)
  }

  if (!rows || rows.length === 0) {
    redirect('/staff/login?error=no_staff_for_restaurant')
  }

  const matchedStaffUser = rows.find((row) => String(row.pin_code).trim() === pinCode)

  if (!matchedStaffUser) {
    redirect('/staff/login?error=invalid_pin')
  }

  await setStaffSession(restaurantId)
  redirect('/staff/redeem')
}

export async function logoutStaff() {
  await clearStaffSession()
  redirect('/staff/login')
}