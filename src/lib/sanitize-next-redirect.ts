/** Open-redirect safe internal paths after auth / login. */

const ALLOWED_ROOTS = [
  { base: '/app' },
  { base: '/activate' },
  { base: '/r' },
  { base: '/account' },
  { base: '/admin' },
  { base: '/pricing' },
  { base: '/map' },
  { base: '/almaty' },
  { base: '/support' },
  { base: '/how-it-works' },
  { base: '/privacy' },
  { base: '/terms' },
  { base: '/payment' },
  { base: '/staff' },
  { base: '/login' },
] as const

/** Path must be internal, on whitelist; preserves original encoding in `value`. */
export function checkNextRedirect(next: string): { ok: true; value: string } | { ok: false } {
  if (typeof next !== 'string') return { ok: false }
  const trimmed = next.trim()
  if (!trimmed) return { ok: false }
  if (trimmed.startsWith('//')) return { ok: false }
  if (!trimmed.startsWith('/')) return { ok: false }
  if (trimmed.includes('\\')) return { ok: false }

  const q = trimmed.indexOf('?')
  const hash = trimmed.indexOf('#')
  const end = [q === -1 ? trimmed.length : q, hash === -1 ? trimmed.length : hash].reduce(
    (a, b) => Math.min(a, b)
  )
  const rawPath = trimmed.slice(0, end)

  let pathname: string
  try {
    pathname = decodeURIComponent(rawPath.replace(/\+/g, '%20'))
  } catch {
    return { ok: false }
  }

  if (!pathname.startsWith('/') || pathname.includes('\\')) return { ok: false }

  if (!isAllowedPathname(pathname)) return { ok: false }
  return { ok: true, value: trimmed }
}

function isAllowedPathname(pathname: string): boolean {
  if (pathname === '/') return true
  for (const { base } of ALLOWED_ROOTS) {
    if (pathname === base || pathname === `${base}/`) return true
    if (pathname.startsWith(`${base}/`)) return true
  }
  return false
}

/**
 * @param ifAbsent — если `next` отсутствует или пустой (например нет query param)
 * @returns безопасный путь; при некорректном `next` возвращает `'/'`
 */
export function sanitizeNextRedirect(
  next: string | null | undefined,
  ifAbsent: string = '/'
): string {
  if (next === null || next === undefined || next === '') return ifAbsent
  const r = checkNextRedirect(next)
  if (!r.ok) return '/'
  return r.value
}

/** Для опционального query `next` на странице логина: неверный параметр → `undefined`. */
export function tryOptionalNext(next: string | undefined): string | undefined {
  if (next === undefined || next === '') return undefined
  const r = checkNextRedirect(next)
  if (!r.ok) return undefined
  return r.value
}
