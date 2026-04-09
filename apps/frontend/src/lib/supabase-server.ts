import { createCompatServerClient } from '@/lib/supabase/compat-server'

export function createSupabaseServerClient() {
  return createCompatServerClient()
}