export async function createSupabaseServerClient() {
  const { createCompatClient } = await import('@/lib/supabase/compat')
  return createCompatClient(true)
}