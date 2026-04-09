import { createCompatServerClient } from '@/lib/supabase/compat-server'

export function createSupabasePublicClient() {
  return createCompatServerClient()
}