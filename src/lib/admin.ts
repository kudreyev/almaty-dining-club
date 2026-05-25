import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireAdmin(returnTo?: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl =
      returnTo && returnTo.startsWith('/')
        ? `/login?next=${encodeURIComponent(returnTo)}`
        : '/login'
    redirect(loginUrl)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/app/me')

  return { supabase, user }
}

/** Для server actions — redirect() ломает client catch и даёт opaque RSC error. */
export async function requireAdminOrThrow(returnTo?: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginHint =
      returnTo && returnTo.startsWith('/')
        ? `/login?next=${encodeURIComponent(returnTo)}`
        : '/login'
    throw new Error(`Сессия истекла. Войдите как admin: ${loginHint}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    throw new Error('Нужны права admin для этой операции.')
  }

  return { supabase, user }
}