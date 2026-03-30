import { LoginForm } from './login-form'
import { normalizeKZPhone } from '@/lib/kz-phone'

function sanitizeNext(next: string | undefined): string | undefined {
  if (!next || typeof next !== 'string') return undefined
  if (!next.startsWith('/') || next.startsWith('//')) return undefined
  return next
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
  return <LoginForm safeNext={sanitizeNext(next)} presetPhone={sanitizePhone(phone)} />
}
