import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  CITY_COOKIE,
  CITY_COOKIE_MAX_AGE,
  isCity,
} from '@/lib/cities'
import { resolveFreeCity } from '@/lib/free-city'
import { supabaseAuthCookieOptions } from '@/lib/supabase/auth-cookie-options'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseAuthCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const merged = {
              ...supabaseAuthCookieOptions,
              ...options,
              maxAge: options.maxAge ?? supabaseAuthCookieOptions.maxAge,
            }
            request.cookies.set(name, value)
            response.cookies.set(name, value, merged)
          })
        },
      },
    },
  )

  // Обновляет access/refresh cookie на каждом заходе (критично для PWA после простоя).
  await supabase.auth.getUser()

  // QR /free: сразу фиксируем город из utm_source / ?city= (каталог и header).
  if (request.nextUrl.pathname === '/free') {
    const city = resolveFreeCity(
      request.nextUrl.searchParams.get('city'),
      request.nextUrl.searchParams.get('utm_source'),
    )
    response.cookies.set(CITY_COOKIE, city, {
      path: '/',
      maxAge: CITY_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
  }

  // Город — фильтр контента: при заходе на '/' с сохранённым городом ведём
  // сразу в его каталог; без cookie на '/' остаётся экран выбора города.
  if (request.nextUrl.pathname === '/') {
    const cityCookie = request.cookies.get(CITY_COOKIE)?.value
    if (isCity(cityCookie)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = `/${cityCookie}`
      const redirect = NextResponse.redirect(redirectUrl)
      for (const cookie of response.cookies.getAll()) {
        redirect.cookies.set(cookie)
      }
      return redirect
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
