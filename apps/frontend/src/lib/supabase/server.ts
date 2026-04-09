export async function createSupabaseServerClient() {
  const { createCompatServerClient } = await import('@/lib/supabase/compat-server')
  return createCompatServerClient()
}