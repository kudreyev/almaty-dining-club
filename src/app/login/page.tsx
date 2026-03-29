import { LoginForm } from './login-form'

function sanitizeNext(next: string | undefined): string | undefined {
  if (!next || typeof next !== 'string') return undefined
  if (!next.startsWith('/') || next.startsWith('//')) return undefined
  return next
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <LoginForm safeNext={sanitizeNext(next)} />
}
