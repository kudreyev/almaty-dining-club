import { redirect } from 'next/navigation'

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
    params.set('phone', phone)
  }
  const qs = params.toString()
  redirect(qs ? `/login?${qs}` : '/login')
}
