import { backendFetch } from '@/lib/backend-api'

export type RestaurantAdminRow = {
  id: string
  restaurant_name: string
  slug: string
  district: string | null
  address: string | null
  phone: string | null
  instagram_url: string | null
  website_url: string | null
  two_gis_url: string | null
  cuisine: string | null
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string | null
  is_active: boolean
}

export type RestaurantHourRow = {
  day_of_week: number
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  close_next_day: boolean
}

export type RestaurantLocationRow = {
  lat: number | null
  lng: number | null
}

export type RestaurantPhotoRow = {
  id: string
  thumb_url: string
  full_url: string
  sort_order: number
}

export type RestaurantPayload = {
  restaurant_name: string
  slug: string
  address: string
  phone: string | null
  instagram_url: string | null
  website_url: string | null
  two_gis_url: string | null
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  short_description: string
  is_active: boolean
  hours: RestaurantHourRow[]
  lat?: number | null
  lng?: number | null
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { ok: boolean; data?: T; error?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? 'Backend request failed')
  }
  return payload.data as T
}

export async function listAdminRestaurants() {
  const response = await backendFetch('/api/restaurants/admin')
  return readJson<RestaurantAdminRow[]>(response)
}

export async function getAdminRestaurant(id: string) {
  const response = await backendFetch(`/api/restaurants/admin/${encodeURIComponent(id)}`)
  return readJson<{
    restaurant: RestaurantAdminRow
    restaurant_hours: RestaurantHourRow[]
    primary_location: RestaurantLocationRow | null
    photos: RestaurantPhotoRow[]
  }>(response)
}

export async function createRestaurantViaApi(payload: RestaurantPayload) {
  const response = await backendFetch('/api/restaurants/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<RestaurantAdminRow>(response)
}

export async function updateRestaurantViaApi(id: string, payload: RestaurantPayload) {
  const response = await backendFetch(`/api/restaurants/admin/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<RestaurantAdminRow>(response)
}
