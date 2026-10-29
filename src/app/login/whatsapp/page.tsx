import { redirect } from 'next/navigation'
import { normalizeToE164Like } from '@/lib/kz-phone'
import { tryOptionalNext } from '@/lib/sanitize-next-redirect'

export default async function WhatsAppLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; phone?: string }>
}) {
  const { next, phone } = await searchParams
  const safeNext = tryOptionalNext(next)
  const params = new URLSearchParams()
  if (safeNext) {
    params.set('next', safeNext)
  }
  if (phone) {
    const normalized = normalizeToE164Like(phone)
    params.set('phone', normalized ?? phone)
  }
  const qs = params.toString()
  redirect(qs ? `/login?${qs}` : '/login')
}
