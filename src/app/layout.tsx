import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: 'KudaPass — подписка на рестораны Алматы',
  description: 'Подписка с офферами 1+1 и комплиментами в ресторанах Алматы.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col bg-[#fafaf9] text-gray-900">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
