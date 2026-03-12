'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

export async function createRestaurant(formData: FormData) {
  const { supabase } = await requireAdmin()

  const payload = {
    restaurant_name: String(formData.get('restaurant_name') || ''),
    slug: String(formData.get('slug') || ''),
    city: 'almaty',
    district: String(formData.get('district') || ''),
    address: String(formData.get('address') || ''),
    phone: String(formData.get('phone') || '') || null,
    instagram_url: String(formData.get('instagram_url') || '') || null,
    website_url: String(formData.get('website_url') || '') || null,
    cuisine: String(formData.get('cuisine') || ''),
    short_description: String(formData.get('short_description') || ''),
    working_hours: String(formData.get('working_hours') || ''),
    price_level: String(formData.get('price_level') || 'mid'),
    photo_1_url: String(formData.get('photo_1_url') || '') || null,
    photo_2_url: String(formData.get('photo_2_url') || '') || null,
    photo_3_url: String(formData.get('photo_3_url') || '') || null,
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('restaurants').insert(payload)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/restaurants')
  redirect('/admin/restaurants')
}

export async function updateRestaurant(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = String(formData.get('id') || '')
  if (!id) throw new Error('Missing id')

  const payload = {
    restaurant_name: String(formData.get('restaurant_name') || ''),
    slug: String(formData.get('slug') || ''),
    district: String(formData.get('district') || ''),
    address: String(formData.get('address') || ''),
    phone: String(formData.get('phone') || '') || null,
    instagram_url: String(formData.get('instagram_url') || '') || null,
    website_url: String(formData.get('website_url') || '') || null,
    cuisine: String(formData.get('cuisine') || ''),
    short_description: String(formData.get('short_description') || ''),
    working_hours: String(formData.get('working_hours') || ''),
    price_level: String(formData.get('price_level') || 'mid'),
    photo_1_url: String(formData.get('photo_1_url') || '') || null,
    photo_2_url: String(formData.get('photo_2_url') || '') || null,
    photo_3_url: String(formData.get('photo_3_url') || '') || null,
    is_active: formData.get('is_active') === 'on',
  }

  const { error } = await supabase.from('restaurants').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/restaurants')
  revalidatePath(`/r/`)
  redirect('/admin/restaurants')
}