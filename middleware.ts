import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import {
  CITY_COOKIE,
  CITY_COOKIE_MAX_AGE,
  CITY_HINT_COOKIE,
  CITY_HINT_SEEN_COOKIE,
  CITY_REQUEST_HEADER,
  DEFAULT_CITY,
  LEGACY_CITY_COOKIE,
  cityFromGeo,
  cityFromPathname,
  isBotUserAgent,
  isCity,
  type City,
} from '@/lib/cities'
import { resolveFreeCity } from '@/lib/free-city'
import { supabaseAuthCookieOptions } from '@/lib/supabase/auth-cookie-options'

type PendingCookie = { name: string; value: string; options: CookieOptions }

const CITY_COOKIE_OPTIONS = {
  path: '/',
  maxAge: CITY_COOKIE_MAX_AGE,
  sameSite: 'lax' as const,
}

function geoCity(request: NextRequest): City | null {
  const h = request.headers
  return cityFromGeo({
    city: h.get('x-vercel-ip-city') ?? h.get('cf-ipcity'),
    region: h.get('x-vercel-ip-country-region'),
    country: h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry'),
  })
}

export async function middleware(request: NextRequest) {
  const authCookies: PendingCookie[] = []

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
            request.cookies.set(name, value)
            authCookies.push({
              name,
              value,
              options: {
                ...supabaseAuthCookieOptions,
                ...options,
                maxAge: options.maxAge ?? supabaseAuthCookieOptions.maxAge,
              },
            })
          })
        },
      },
    },
  )

  // Обновляет access/refresh cookie на каждом заходе (критично для PWA после простоя).
  await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const savedCity = request.cookies.get(CITY_COOKIE)?.value
  const legacyCity = request.cookies.get(LEGACY_CITY_COOKIE)?.value
  const manualCity: City | null = isCity(savedCity)
    ? savedCity
    : isCity(legacyCity)
      ? legacyCity
      : null

  const withCookies = (response: NextResponse) => {
    for (const { name, value, options } of authCookies) {
      response.cookies.set(name, value, options)
    }
    if (manualCity && savedCity !== manualCity) {
      response.cookies.set(CITY_COOKIE, manualCity, CITY_COOKIE_OPTIONS)
    }
    return response
  }

  const redirectTo = (city: City, status: 301 | 302 | 307) => {
    const url = request.nextUrl.clone()
    url.pathname = `/${city}`
    return withCookies(NextResponse.redirect(url, status))
  }

  // Старый QR-лендинг /free (напечатан в заведениях): город из utm_source / ?city=,
  // затем каталог города с теми же utm.
  if (pathname === '/free') {
    const city = resolveFreeCity(
      request.nextUrl.searchParams.get('city'),
      request.nextUrl.searchParams.get('utm_source'),
    )
    const url = request.nextUrl.clone()
    url.pathname = `/${city}`
    url.searchParams.delete('city')
    const redirect = withCookies(NextResponse.redirect(url))
    redirect.cookies.set(CITY_COOKIE, city, CITY_COOKIE_OPTIONS)
    return redirect
  }

  if (pathname === '/pricing') {
    return redirectTo(manualCity ?? geoCity(request) ?? DEFAULT_CITY, 301)
  }

  // «/» ведём сразу в город: выбранный вручную → по IP → Алматы.
  // Роботам оставляем «/» как индексируемую страницу со ссылками на все города.
  if (pathname === '/' && !isBotUserAgent(request.headers.get('user-agent'))) {
    if (manualCity) return redirectTo(manualCity, 302)

    const city = geoCity(request) ?? DEFAULT_CITY
    const redirect = redirectTo(city, 302)
    // Подсказку «Ваш город …?» показываем один раз: час или до ответа.
    if (!request.cookies.has(CITY_HINT_SEEN_COOKIE)) {
      redirect.cookies.set(CITY_HINT_COOKIE, city, { path: '/', maxAge: 60 * 60, sameSite: 'lax' })
      redirect.cookies.set(CITY_HINT_SEEN_COOKIE, '1', CITY_COOKIE_OPTIONS)
    }
    return redirect
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(
    CITY_REQUEST_HEADER,
    cityFromPathname(pathname) ?? manualCity ?? geoCity(request) ?? DEFAULT_CITY,
  )
  return withCookies(NextResponse.next({ request: { headers: requestHeaders } }))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
