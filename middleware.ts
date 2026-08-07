import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { CITY_COOKIE, isCity } from '@/lib/cities'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  // Город — фильтр контента: при заходе на '/' с сохранённым городом ведём
  // сразу в его каталог; без cookie на '/' остаётся экран выбора города.
  if (request.nextUrl.pathname === '/') {
    const cityCookie = request.cookies.get(CITY_COOKIE)?.value
    if (isCity(cityCookie)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = `/${cityCookie}`
      const redirect = NextResponse.redirect(redirectUrl)
      // Переносим обновлённые auth-cookie на редирект-ответ.
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