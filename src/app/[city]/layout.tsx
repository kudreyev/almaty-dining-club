import { notFound } from 'next/navigation'
import { isCity } from '@/lib/cities'

export default async function CityLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ city: string }>
}) {
  const { city } = await params
  if (!isCity(city)) notFound()

  return <>{children}</>
}
