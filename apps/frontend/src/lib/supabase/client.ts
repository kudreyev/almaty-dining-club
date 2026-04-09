import { createCompatClient } from '@/lib/supabase/compat-client'

export function createSupabaseBrowserClient() {
  return createCompatClient()
}