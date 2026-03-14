'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'

export async function addLocation(formData: FormData) {
  const { supabase } = await requireAdmin()

  const restaurantId = String(formData.get('restaurantId') || '')
  const address = String(formData.get('address') || '').trim()

  if (!restaurantId || !address) {
    redirect(`/admin/restaurants/${restaurantId}/locations?error=missing`)
  }

  const { error } = await supabase.from('restaurant_locations').insert({
    restaurant_id: restaurantId,
    address,
    is_active: true,
    sort_order: 0,
  })

  if (error) {
    redirect(`/admin/restaurants/${restaurantId}/locations?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/admin/restaurants/${restaurantId}/locations`)
  revalidatePath(`/r/`) // для витрины
  redirect(`/admin/restaurants/${restaurantId}/locations?ok=1`)
}

export async function deleteLocation(formData: FormData) {
  const { supabase } = await requireAdmin()

  const restaurantId = String(formData.get('restaurantId') || '')
  const locationId = String(formData.get('locationId') || '')

  if (!restaurantId || !locationId) {
    redirect(`/admin/restaurants/${restaurantId}/locations?error=missing`)
  }

  const { error } = await supabase
    .from('restaurant_locations')
    .delete()
    .eq('id', locationId)

  if (error) {
    redirect(`/admin/restaurants/${restaurantId}/locations?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/admin/restaurants/${restaurantId}/locations`)
  revalidatePath(`/r/`)
  redirect(`/admin/restaurants/${restaurantId}/locations?ok=1`)
}