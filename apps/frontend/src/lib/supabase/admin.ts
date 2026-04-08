import { createCompatClient } from '@/lib/supabase/compat'

export function createSupabaseAdminClient() {
  return createCompatClient(true)
}
