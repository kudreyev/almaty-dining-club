import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/header'
import { HeaderShell } from '@/components/header-shell'
import { Footer } from '@/components/footer'
import { YandexMetrica } from '@/components/yandex-metrica'
import {
  buildMetaPixelBootstrapScript,
  sanitizeMetaPixelId,
} from '@/lib/meta-pixel-bootstrap'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: 'Kudaclub — подписка на рестораны Алматы',
  description: 'Подписка с офферами 2 за 1 и в подарок в ресторанах Алматы.',
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
        <div className="flex min-h-screen flex-col bg-[#fafaf9] text-gray-900">
          <HeaderShell>
            <Header />
          </HeaderShell>
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <YandexMetrica />
      </body>
    </html>
  )
}
