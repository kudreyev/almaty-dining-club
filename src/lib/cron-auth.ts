/** Проверка Authorization: Bearer <CRON_SECRET> для Vercel Cron и ручных вызовов. */
export function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${cronSecret}`
}
