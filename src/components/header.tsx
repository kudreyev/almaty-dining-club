import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { MobileMenu } from '@/components/mobile-menu'
import SubscribeCTA from '@/components/checkout/subscribe-cta'
import { CitySelector } from '@/components/city-selector'
import { CITY_COOKIE, DEFAULT_CITY, isCity } from '@/lib/cities'

export async function Header() {
  let user: User | null = null
  let role: 'user' | 'admin' | null = null

  const cookieStore = await cookies()
  const cityCookie = cookieStore.get(CITY_COOKIE)?.value
  const city = isCity(cityCookie) ? cityCookie : DEFAULT_CITY

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
    { href: '/pricing', label: 'Подписка' },
  ]

  const adminLinks = role === 'admin'
    ? [
        { href: '/admin/dashboard', label: 'Дашборд' },
        { href: '/admin/users', label: 'Пользователи' },
        { href: '/admin/restaurants', label: 'Заведения' },
        { href: '/admin/offers', label: 'Офферы' },
        { href: '/admin/staff', label: 'Сотрудники' },
        { href: '/admin/activation-links', label: 'Активации' },
        { href: '/admin/transfer-subscription', label: 'Перенос' },
        { href: '/admin/payments', label: 'Оплаты' },
      ]
    : []

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          href={`/${city}`}
          className="font-semibold text-neutral-900"
          style={{ fontSize: '18px', letterSpacing: '-0.4px' }}
        >
          Kuda<span style={{ color: '#D85A30' }}>club</span>
        </Link>

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
                href="/login"
                className="hidden text-[13px] font-medium transition-colors hover:text-neutral-900 md:inline-flex"
                style={{ color: '#8a8a8a' }}
              >
                Войти
              </Link>
              <SubscribeCTA
                source="header"
                className="inline-flex items-center justify-center rounded-lg bg-[#D85A30] px-3.5 py-[7px] text-[13px] font-medium text-white transition-opacity hover:opacity-95"
              >
                Попробовать за 1 990 ₸
              </SubscribeCTA>
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
          />
        </div>
      </div>
    </header>
  )
}
