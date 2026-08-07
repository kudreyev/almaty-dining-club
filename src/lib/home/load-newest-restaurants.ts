import { createSupabasePublicClient } from '@/lib/supabase/public'
import type { City } from '@/lib/cities'

export type NewestRestaurant = {
  id: string
  restaurant_name: string
  slug: string
  city: City | string
  cuisine: string | null
  created_at: string
  photoUrl: string | null
}

/** Последние добавленные активные заведения выбранного города. */
export async function loadNewestRestaurants(
  limit = 3,
  city?: City,
): Promise<NewestRestaurant[]> {
  const supabase = createSupabasePublicClient()

  let query = supabase
    .from('restaurants')
    .select('id, restaurant_name, slug, city, cuisine, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (city) {
    query = query.eq('city', city)
  }

  const { data } = await query.returns<
    {
      id: string
      restaurant_name: string
      slug: string
      city: string
      cuisine: string | null
      created_at: string
    }[]
  >()

  const rows = data ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data: photos } = await supabase
    .from('restaurant_photos')
    .select('restaurant_id, thumb_url, sort_order')
    .in('restaurant_id', ids)
    .order('sort_order', { ascending: true })

  const photoById = new Map<string, string>()
  for (const photo of photos ?? []) {
    if (!photoById.has(photo.restaurant_id) && photo.thumb_url) {
      photoById.set(photo.restaurant_id, photo.thumb_url)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    restaurant_name: r.restaurant_name,
    slug: r.slug,
    city: r.city,
    cuisine: r.cuisine,
    created_at: r.created_at,
    photoUrl: photoById.get(r.id) ?? null,
  }))
}

/** Сколько заведений новее указанной метки (для Badging API). */
export async function countRestaurantsNewerThan(
  sinceIso: string,
): Promise<number> {
  const supabase = createSupabasePublicClient()
  const { count } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .gt('created_at', sinceIso)

  return count ?? 0
}
