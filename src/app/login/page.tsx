import { LoginForm } from './login-form'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { tryOptionalNext } from '@/lib/sanitize-next-redirect'

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
  return <LoginForm safeNext={tryOptionalNext(next)} presetPhone={sanitizePhone(phone)} />
}
