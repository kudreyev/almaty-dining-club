import { createCompatClient } from '@/lib/supabase/compat'

export function createSupabaseBrowserClient() {
  return createCompatClient(false)
}