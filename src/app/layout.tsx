import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/header'
import { HeaderShell } from '@/components/header-shell'
import { Footer } from '@/components/footer'
import { YandexMetrica } from '@/components/yandex-metrica'

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
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

  return (
    <html lang="ru">
      <body className={inter.className}>
        {metaPixelId ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(metaPixelId)});
fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height={1}
                width={1}
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${encodeURIComponent(metaPixelId)}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
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
