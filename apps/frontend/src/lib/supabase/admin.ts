import { createCompatServerClient } from '@/lib/supabase/compat-server'

export function createSupabaseAdminClient() {
  return createCompatServerClient()
}
