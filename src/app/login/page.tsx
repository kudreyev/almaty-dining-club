import { LoginForm } from './login-form'
import { normalizeKZPhone } from '@/lib/kz-phone'
import { tryOptionalNext } from '@/lib/sanitize-next-redirect'

function sanitizePhone(phone: string | undefined): string | undefined {
  if (!phone || typeof phone !== 'string') return undefined
  return normalizeKZPhone(phone) ?? undefined
}

// Принимаем только hex-токены (формат randomToken32Hex из activation-links.ts:
// 32 hex-символа). Это убирает любые попытки протащить мусор в server action.
// Сама валидность токена всё равно перепроверяется на сервере по БД.
function sanitizeActivationToken(token: string | undefined): string | undefined {
  if (!token || typeof token !== 'string') return undefined
  const trimmed = token.trim()
  if (!/^[a-f0-9]{32}$/i.test(trimmed)) return undefined
  return trimmed
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; phone?: string; activation_token?: string }>
}) {
  const { next, phone, activation_token } = await searchParams
  return (
    <LoginForm
      safeNext={tryOptionalNext(next)}
      presetPhone={sanitizePhone(phone)}
      activationToken={sanitizeActivationToken(activation_token)}
    />
  )
}
