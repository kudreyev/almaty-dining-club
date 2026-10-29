'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function markStaffByPhone(formData: FormData): Promise<{
  ok: boolean
  error?: string
  marked?: number
}> {
  await requireAdmin()

  const raw = String(formData.get('phone') ?? '').trim()
  const phone = normalizeKZPhone(raw)
  if (!phone) {
    return { ok: false, error: 'Некорректный KZ-номер.' }
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.rpc('mark_profiles_staff_by_phones', {
    p_phones: [phone],
  })
  if (error) {
    return { ok: false, error: error.message }
  }

  const marked = typeof data === 'number' ? data : 0
  if (marked === 0) {
    return { ok: false, error: `Профиль с номером ${phone} не найден.` }
  }

  revalidatePath('/admin/users')
  revalidatePath('/admin/dashboard')

  return { ok: true, marked }
}
