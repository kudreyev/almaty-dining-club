import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.supabase.in', pathname: '/storage/v1/object/public/**' },
    ],
  },
  // title/description/og всегда в <head>, а не стримятся в <body>: Яндекс и превью
  // мессенджеров читают только исходный HTML.
  htmlLimitedBots: /.*/,
  // Сервис бесплатный: старые страницы оплаты ведут на главную (query сохраняется).
  // /free и /pricing обрабатывает middleware — там нужен город пользователя.
  async redirects() {
    return [
      '/how-it-works',
      '/activate',
      '/payment',
      '/payment/:path*',
      '/checkout',
      '/checkout/:path*',
    ].map((source) => ({ source, destination: '/', permanent: false }))
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
