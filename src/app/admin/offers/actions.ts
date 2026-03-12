'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

export async function createOffer(formData: FormData) {
  const { supabase } = await requireAdmin()

  const restaurantId = String(formData.get('restaurant_id') || '')
  if (!restaurantId) throw new Error('Missing restaurant_id')

  const payload = {
    restaurant_id: restaurantId,
    offer_type: String(formData.get('offer_type') || '2for1'),
    offer_title: String(formData.get('offer_title') || ''),
    offer_terms_short: String(formData.get('offer_terms_short') || ''),
    offer_terms_full: String(formData.get('offer_terms_full') || ''),
    offer_days: String(formData.get('offer_days') || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    offer_time_from: String(formData.get('offer_time_from') || '12:00'),
    offer_time_to: String(formData.get('offer_time_to') || '22:00'),
    requires_main_course: formData.get('requires_main_course') === 'on',
    is_stackable_with_other_promos: formData.get('is_stackable_with_other_promos') === 'on',
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

  const payload = {
    offer_type: String(formData.get('offer_type') || '2for1'),
    offer_title: String(formData.get('offer_title') || ''),
    offer_terms_short: String(formData.get('offer_terms_short') || ''),
    offer_terms_full: String(formData.get('offer_terms_full') || ''),
    offer_days: String(formData.get('offer_days') || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    offer_time_from: String(formData.get('offer_time_from') || '12:00'),
    offer_time_to: String(formData.get('offer_time_to') || '22:00'),
    requires_main_course: formData.get('requires_main_course') === 'on',
    is_stackable_with_other_promos: formData.get('is_stackable_with_other_promos') === 'on',
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('offers').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath(`/admin/offers/${restaurantId}`)
  redirect(`/admin/offers/${restaurantId}`)
}