import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'
import { MobileMenu } from '@/components/mobile-menu'
import { Button } from '@/components/ui/button'

export async function Header() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: 'user' | 'admin' | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    role = profile?.role ?? 'user'
  }

  const navLinks = [
    { href: '/', label: 'Рестораны' },
    { href: '/pricing', label: 'Подписка' },
  ]

  const adminLinks = role === 'admin'
    ? [
        { href: '/admin/restaurants', label: 'Заведения' },
        { href: '/admin/offers', label: 'Офферы' },
        { href: '/admin/staff', label: 'Сотрудники' },
        { href: '/admin/activation-links', label: 'Активации' },
        { href: '/admin/transfer-subscription', label: 'Перенос' },
        { href: '/admin/payments', label: 'Оплаты' },
      ]
    : []

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand">
          KudaPass
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
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
                  className="rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
                >
                  {l.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          {!user ? (
            <Button href="/login" size="sm">
              Войти
            </Button>
          ) : (
            <>
              <Button href="/app/me" size="sm">
                Кабинет
              </Button>
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
