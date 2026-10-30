import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { MobileMenu } from '@/components/mobile-menu'
import { CitySelector } from '@/components/city-selector'
import { CityHint } from '@/components/city-hint'
import { GoalLink } from '@/components/analytics/goal-link'
import { StandaloneBackButton } from '@/components/pwa/standalone-back-button'
import { CITY_HINT_COOKIE, isCity } from '@/lib/cities'
import { getCurrentCity, getManualCity } from '@/lib/current-city'

export async function Header() {
  let user: User | null = null
  let role: 'user' | 'admin' | null = null

  const cookieStore = await cookies()
  const city = await getCurrentCity()
  const hintCity = cookieStore.get(CITY_HINT_COOKIE)?.value
  const showCityHint = isCity(hintCity) && hintCity === city && !(await getManualCity())
  const loginHref = `/login?next=${encodeURIComponent(`/${city}`)}`

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anonKey) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      role = profile?.role ?? 'user'
    }
  }

  const navLinks = [
    { href: `/${city}`, label: 'Заведения' },
    { href: `/${city}/map`, label: 'Карта' },
  ]

  const adminLinks = role === 'admin'
    ? [
        { href: '/admin/dashboard', label: 'Дашборд' },
        { href: '/admin/analytics', label: 'Аналитика' },
        { href: '/admin/users', label: 'Пользователи' },
        { href: '/admin/restaurants', label: 'Заведения' },
        { href: '/admin/offers', label: 'Офферы' },
        { href: '/admin/staff', label: 'Сотрудники' },
        { href: '/admin/push', label: 'Пуши' },
      ]
    : []

  return (
    <header
      className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-lg"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-1">
          <StandaloneBackButton fallbackHref={`/${city}`} />
          <Link
            href={`/${city}`}
            className="font-semibold text-neutral-900"
            style={{ fontSize: '18px', letterSpacing: '-0.4px' }}
          >
            Kuda<span style={{ color: '#D85A30' }}>club</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-accent-soft hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
          {adminLinks.length > 0 ? (
            <>
              <span className="mx-2 h-4 w-px bg-gray-200" />
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-accent-soft hover:text-accent"
                >
                  {l.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          <CitySelector current={city} />
          {!user ? (
            <>
              <Link
                href={loginHref}
                className="hidden text-[13px] font-medium transition-colors hover:text-neutral-900 md:inline-flex"
                style={{ color: '#8a8a8a' }}
              >
                Войти
              </Link>
              <GoalLink
                href={loginHref}
                goal="login_cta_click"
                source="header"
                className="inline-flex items-center justify-center rounded-lg bg-[#D85A30] px-3.5 py-[7px] text-[13px] font-medium text-white transition-opacity hover:opacity-95"
              >
                <span className="md:hidden">Получить доступ</span>
                <span className="hidden md:inline">Получить доступ бесплатно</span>
              </GoalLink>
            </>
          ) : (
            <>
              <Link
                href="/app/me"
                className="inline-flex items-center justify-center font-medium text-white transition-opacity hover:opacity-95"
                style={{
                  background: '#D85A30',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '13px',
                }}
              >
                Кабинет
              </Link>
              <LogoutButton />
            </>
          )}
          <MobileMenu
            navLinks={navLinks}
            adminLinks={adminLinks}
            isLoggedIn={!!user}
            loginHref={loginHref}
          />
        </div>
      </div>
      {showCityHint ? <CityHint city={city} /> : null}
    </header>
  )
}
