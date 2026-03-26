import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
})

export const metadata: Metadata = {
  title: 'KudaPass',
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
        <div className="min-h-screen bg-[#fafaf8] text-black">
          <Header />
          <div>{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  )
}