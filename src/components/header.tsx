import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'

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

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          KudaPass
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm font-medium text-gray-600 hover:text-black">
            Главная
          </Link>
          <Link href="/almaty" className="text-sm font-medium text-gray-600 hover:text-black">
            Рестораны
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-black">
            Подписка
          </Link>

          {role === 'admin' ? (
            <>
              <Link
                href="/admin/restaurants"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Заведения
              </Link>
              <Link
                href="/admin/offers"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Офферы
              </Link>
              <Link
                href="/admin/staff"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Сотрудники
              </Link>
              <Link
                href="/admin/import"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Импорт
              </Link>
              <Link
                href="/admin/activation-links"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Активации
              </Link>
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          {!user ? (
            <Link
              href="/login"
              className="inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Вход
            </Link>
          ) : (
            <>
              <Link
                href="/app/me"
                className="inline-flex rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Кабинет
              </Link>
              <LogoutButton />
            </>
          )}
        </div>
      </div>
    </header>
  )
}