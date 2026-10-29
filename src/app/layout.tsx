import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/header'
import { HeaderShell } from '@/components/header-shell'
import { Footer } from '@/components/footer'
import { YandexMetrica } from '@/components/yandex-metrica'
import { UtmCapture } from '@/components/analytics/utm-capture'
import { PwaRegister } from '@/components/pwa-register'
import { PwaInstallProvider } from '@/components/pwa/pwa-install-provider'
import { PushClickTracker } from '@/components/pwa/push-click-tracker'
import { Heartbeat } from '@/components/pwa/heartbeat'
import { PwaAppBadge } from '@/components/pwa/pwa-app-badge'
import { SessionKeepAlive } from '@/components/auth/session-keepalive'
import {
  buildMetaPixelBootstrapScript,
  sanitizeMetaPixelId,
} from '@/lib/meta-pixel-bootstrap'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
})

export const viewport: Viewport = {
  themeColor: '#D85A30',
  colorScheme: 'light',
}

export const metadata: Metadata = {
  title: 'KudaClub: 2-за-1 в кафе и ресторанах Алматы бесплатно',
  description:
    'Бесплатные предложения 2-за-1, напитки и десерты в лучших заведениях Алматы. Без подписки и приложения.',
  applicationName: 'kudaclub',
  openGraph: {
    title: 'KudaClub: 2-за-1 в кафе и ресторанах Алматы бесплатно',
    description:
      'Бесплатные предложения 2-за-1, напитки и десерты в лучших заведениях Алматы. Без подписки и приложения.',
    siteName: 'KudaClub',
    locale: 'ru_RU',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    title: 'kudaclub',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const metaPixelId = sanitizeMetaPixelId(
    process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '',
  )

  return (
    <html lang="ru">
      <head>
        {/* iOS Safari: явный apple-мета-тег (помимо Metadata API). */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {metaPixelId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: buildMetaPixelBootstrapScript(metaPixelId),
            }}
          />
        ) : null}
      </head>
      <body className={inter.className}>
        {metaPixelId ? (
          <noscript>
            <img
              height={1}
              width={1}
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        ) : null}
        <PwaInstallProvider>
          <UtmCapture />
          <PwaRegister />
          <PushClickTracker />
          <Heartbeat />
          <SessionKeepAlive />
          <PwaAppBadge />
          <div className="flex min-h-screen flex-col bg-[#fafaf9] text-gray-900">
            <HeaderShell>
              <Header />
            </HeaderShell>
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </PwaInstallProvider>
        <YandexMetrica />
      </body>
    </html>
  )
}
