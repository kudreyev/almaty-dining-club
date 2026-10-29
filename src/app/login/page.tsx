import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LoginForm } from './login-form'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { tryOptionalNext } from '@/lib/sanitize-next-redirect'
import { CITY_COOKIE, DEFAULT_CITY, isCity } from '@/lib/cities'

export const metadata: Metadata = {
  title: 'Вход и регистрация — KudaClub',
  description: 'Регистрация по номеру телефона за 30 секунд. Бесплатно, без подписки.',
}

function sanitizePhone(phone: string | undefined): string | undefined {
  if (!phone || typeof phone !== 'string') return undefined
  return normalizeKZPhone(phone) ?? undefined
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; phone?: string }>
}) {
  const { next, phone } = await searchParams
  const cookieStore = await cookies()
  const cityCookie = cookieStore.get(CITY_COOKIE)?.value
  const city = isCity(cityCookie) ? cityCookie : DEFAULT_CITY

  return (
    <LoginForm
      safeNext={tryOptionalNext(next)}
      defaultNext={`/${city}`}
      presetPhone={sanitizePhone(phone)}
    />
  )
}
