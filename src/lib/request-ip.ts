import { headers } from 'next/headers'

/** Первый IP клиента из заголовков прокси (Vercel / CF). */
export async function getRequestClientIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? 'unknown'
}
