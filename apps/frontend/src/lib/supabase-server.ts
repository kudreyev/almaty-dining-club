import { createCompatClient } from '@/lib/supabase/compat'

export function createSupabaseServerClient() {
  return createCompatClient(true)
}