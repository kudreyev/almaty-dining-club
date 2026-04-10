export function getServerApiBaseUrl() {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://backend:4000'
  ).replace(/\/$/, '')
}

export function getBrowserApiBaseUrl() {
  return ''
}

export function getPublicApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ''
  ).replace(/\/$/, '')
}
