import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Пока фестивали в превью: на сайте их видят только админы.
 * Чтобы открыть всем: FESTIVAL_ADMIN_ONLY=false в env.
 */
export function isFestivalAdminOnly(): boolean {
  return process.env.FESTIVAL_ADMIN_ONLY !== 'false'
}

export const canViewFestivals = cache(async (): Promise<boolean> => {
  if (!isFestivalAdminOnly()) return true

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>()

  return profile?.role === 'admin'
})
