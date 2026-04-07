/**
 * Origin for in-app deep links (QR, redirects). Prefer NEXT_PUBLIC_SITE_URL so
 * dev (localhost) and prod each get a matching URL.
 */
export function getAppSiteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    ''
  )
}
