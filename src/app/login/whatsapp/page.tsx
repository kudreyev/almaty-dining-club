import { redirect } from 'next/navigation'

export default async function WhatsAppLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const params = new URLSearchParams()
  if (next) {
    params.set('next', next)
  }
  const qs = params.toString()
  redirect(qs ? `/login?${qs}` : '/login')
}
