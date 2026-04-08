import { createCompatClient } from '@/lib/supabase/compat'

export function createSupabasePublicClient() {
  return createCompatClient(false)
}