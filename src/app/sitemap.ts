import type { MetadataRoute } from 'next'
import { CITIES } from '@/lib/cities'
import { logServerError } from '@/lib/safe-errors'
import { SITE_URL } from '@/lib/seo'
import { createSupabasePublicClient } from '@/lib/supabase/public'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...CITIES.flatMap((city) => [
      { url: `${SITE_URL}/${city}`, changeFrequency: 'daily' as const, priority: 0.9 },
      { url: `${SITE_URL}/${city}/map`, changeFrequency: 'weekly' as const, priority: 0.6 },
    ]),
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${SITE_URL}/offer`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.1 },
  ]

  const { data, error } = await createSupabasePublicClient()
    .from('restaurants')
    .select('slug')
    .eq('is_active', true)
    .returns<{ slug: string }[]>()
  if (error) {
    logServerError('sitemap', error)
    return pages
  }

  return [
    ...pages,
    ...(data ?? []).map(({ slug }) => ({
      url: `${SITE_URL}/r/${encodeURIComponent(slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
