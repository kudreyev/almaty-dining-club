import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAuthCookieOptions } from '@/lib/supabase/auth-cookie-options'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseAuthCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...supabaseAuthCookieOptions,
                ...options,
                maxAge: options.maxAge ?? supabaseAuthCookieOptions.maxAge,
              })
            })
          } catch {
            // Server Components sometimes can't set cookies directly.
            // Middleware/proxy will handle refresh flows.
          }
        },
      },
    },
  )
}
