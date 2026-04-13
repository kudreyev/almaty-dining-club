import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerApiBaseUrl } from '@/lib/api-base-url'

export type BackendUser = {
  id: string
  phone: string | null
  email: string | null
  role: 'user' | 'admin'
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  const headers = new Headers(init.headers)

  if (cookieHeader && !headers.has('Cookie')) {
    headers.set('Cookie', cookieHeader)
  }

  return fetch(`${getServerApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? 'no-store',
  })
}

export async function getCurrentBackendUser() {
  const response = await backendFetch('/api/auth/me')
  if (!response.ok) return null

  const payload = (await response.json()) as {
    ok: boolean
    userId: string
    phone: string | null
    email: string | null
    role: 'user' | 'admin'
  }

  if (!payload.ok) return null

  return {
    id: payload.userId,
    phone: payload.phone,
    email: payload.email,
    role: payload.role,
  } satisfies BackendUser
}

export async function requireBackendAdmin() {
  const user = await getCurrentBackendUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/app/me')
  return { user }
}

