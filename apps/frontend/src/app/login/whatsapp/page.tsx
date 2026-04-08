import { redirect } from 'next/navigation'
import { normalizeToE164Like } from '@/lib/kz-phone'

export default async function WhatsAppLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; phone?: string }>
}) {
  const { next, phone } = await searchParams
  const params = new URLSearchParams()
  if (next) {
    params.set('next', next)
  }
  if (phone) {
    const normalized = normalizeToE164Like(phone)
    params.set('phone', normalized ?? phone)
  }
  const qs = params.toString()
  redirect(qs ? `/login?${qs}` : '/login')
}
