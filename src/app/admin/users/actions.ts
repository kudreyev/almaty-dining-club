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

  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const digits = phone.replace(/\D/g, '')
  const authUser = authUsers.users.find((u) => {
    const meta = u.user_metadata?.phone_e164
    if (typeof meta === 'string' && meta === phone) return true
    if (u.phone === phone) return true
    if (u.email === `wa_${digits}@wa.local`) return true
    return false
  })

  if (authUser?.id) {
    const { error: subError } = await admin.rpc('ensure_staff_subscription', {
      p_user_id: authUser.id,
    })
    if (subError) {
      return { ok: false, error: subError.message }
    }
  }

  revalidatePath('/admin/users')
  revalidatePath('/admin/dashboard')

  return { ok: true, marked }
}
