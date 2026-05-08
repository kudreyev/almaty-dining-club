import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { updateRestaurant } from '../../actions'
import { deleteRestaurantPhoto, reorderRestaurantPhoto } from './photo-actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { RestaurantPhotoUpload } from '@/components/admin/restaurant-photo-upload'
import { RestaurantHoursFields } from '@/components/admin/restaurant-hours-fields'
import type { RestaurantHour } from '@/lib/opening-hours'
import { getFallbackByContext } from '@/lib/safe-errors'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ photoOk?: string; photoError?: string }>
}

type RestaurantLocationCoords = {
  lat: number | null
  lng: number | null
}

type RestaurantPhoto = {
  id: string
  thumb_url: string
  full_url: string
  sort_order: number
}

type RestaurantRecord = {
  id: string
  restaurant_name: string
  slug: string
  address: string
  cuisine: string
  cuisine_2: string | null
  cuisine_3: string | null
  tags: string[] | null
  instagram_url: string | null
  two_gis_url: string | null
  external_rating: number | null
  external_reviews_count: number | null
  phone: string | null
  whatsapp_phone: string | null
  is_active: boolean
}

export default async function AdminRestaurantEditPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { photoOk, photoError } = await searchParams
  const { supabase } = await requireAdmin()

  const [{ data: r }, { data: restaurantHours }, { data: primaryLocation }, { data: photos }] = await Promise.all([
    supabase
      .from('restaurants')
      .select(`
        id,
        restaurant_name,
        slug,
        address,
        cuisine,
        cuisine_2,
        cuisine_3,
        tags,
        instagram_url,
        two_gis_url,
        external_rating,
        external_reviews_count,
        phone,
        whatsapp_phone,
        is_active
      `)
      .eq('id', id)
      .single<RestaurantRecord>(),
    supabase
      .from('restaurant_hours')
      .select('day_of_week, is_closed, open_time, close_time, close_next_day')
      .eq('restaurant_id', id)
      .order('day_of_week', { ascending: true })
      .returns<RestaurantHour[]>(),
    supabase
      .from('restaurant_locations')
      .select('lat, lng')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle<RestaurantLocationCoords>(),
    supabase
      .from('restaurant_photos')
      .select('id, thumb_url, full_url, sort_order')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<RestaurantPhoto[]>(),
  ])

  if (!r) notFound()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Редактировать</h1>
        <div className="flex gap-2">
          <Button href="/admin/restaurants" variant="ghost" size="sm">← Назад</Button>
        </div>
      </div>

      <Card>
        <form action={updateRestaurant} className="space-y-4">
          <input type="hidden" name="id" value={r.id} />
          <Input name="restaurant_name" label="Название" defaultValue={r.restaurant_name} required data-ym-disable-keys />
          <Input name="slug" label="Slug" defaultValue={r.slug} required />
          <Input name="address" label="Адрес" defaultValue={r.address} required data-ym-disable-keys />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="cuisine" label="Кухня" defaultValue={r.cuisine} required />
            <Input name="cuisine_2" label="Кухня 2" defaultValue={r.cuisine_2 ?? ''} placeholder="Опционально" />
            <Input name="cuisine_3" label="Кухня 3" defaultValue={r.cuisine_3 ?? ''} placeholder="Опционально" />
          </div>
          <Input
            name="tags"
            label="Теги (через запятую)"
            defaultValue={(r.tags ?? []).join(', ')}
            placeholder="Ужины, Свидания, Винная карта"
          />
          <Input name="instagram_url" label="Instagram" defaultValue={r.instagram_url ?? ''} />

          <fieldset className="rounded-xl border border-gray-200 p-4">
            <legend className="px-2 text-sm font-medium text-gray-700">Информация из 2GIS</legend>
            <div className="space-y-4">
              <Input
                name="two_gis_url"
                label="Ссылка 2GIS"
                defaultValue={r.two_gis_url ?? ''}
                placeholder="https://2gis.kz/almaty/firm/..."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="external_rating"
                  type="number"
                  step={0.1}
                  min={1}
                  max={5}
                  label="Рейтинг 2GIS"
                  placeholder="4.7"
                  defaultValue={r.external_rating == null ? '' : String(r.external_rating)}
                />
                <Input
                  name="external_reviews_count"
                  type="number"
                  step={1}
                  min={0}
                  label="Количество отзывов 2GIS"
                  placeholder="312"
                  defaultValue={r.external_reviews_count == null ? '' : String(r.external_reviews_count)}
                />
              </div>
              <p className="text-sm text-gray-500">
                Все три поля опциональные. Рейтинг будет показан на странице заведения только если все три поля заполнены.
              </p>
            </div>
          </fieldset>

          <div>
            <label className="mb-1.5 block text-base font-medium text-gray-700">Телефон</label>
            <PhoneInput name="phone" defaultValue={r.phone ?? ''} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent" />
          </div>
          <Input name="whatsapp_phone" label="WhatsApp" defaultValue={r.whatsapp_phone ?? ''} placeholder="+77001234567" data-ym-disable-keys />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="lat"
              label="Широта (lat)"
              defaultValue={primaryLocation?.lat != null ? String(primaryLocation.lat) : ''}
              placeholder="43.238949"
            />
            <Input
              name="lng"
              label="Долгота (lng)"
              defaultValue={primaryLocation?.lng != null ? String(primaryLocation.lng) : ''}
              placeholder="76.889709"
            />
          </div>
          <RestaurantHoursFields initialHours={restaurantHours ?? []} />

          <label className="flex items-center gap-2 text-base text-gray-600">
            <input type="checkbox" name="is_active" defaultChecked={!!r.is_active} className="rounded" />
            Активен
          </label>

          <Button type="submit" className="w-full">
            Сохранить
          </Button>
        </form>
      </Card>

      {photoOk ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">
          Фотографии обновлены.
        </div>
      ) : null}

      {photoError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {getFallbackByContext('photo-upload')}
        </div>
      ) : null}

      <Card className="mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Фотографии</h2>
          <p className="mt-1 text-base text-gray-500">Загрузка до 10 изображений за раз.</p>
        </div>

        <RestaurantPhotoUpload restaurantId={r.id} />

        {!photos || photos.length === 0 ? (
          <EmptyState title="Фотографий пока нет" description="Загрузите первое фото заведения" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {photos.map((photo, index) => (
              <div key={photo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumb_url || photo.full_url} alt={`Фото ${index + 1}`} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="text-sm text-gray-500">Позиция: {photo.sort_order}</p>
                  <div className="flex items-center gap-2">
                    <form action={reorderRestaurantPhoto}>
                      <input type="hidden" name="restaurantId" value={r.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button type="submit" variant="secondary" size="sm" disabled={index === 0}>Вверх</Button>
                    </form>
                    <form action={reorderRestaurantPhoto}>
                      <input type="hidden" name="restaurantId" value={r.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button type="submit" variant="secondary" size="sm" disabled={index === photos.length - 1}>Вниз</Button>
                    </form>
                    <form action={deleteRestaurantPhoto}>
                      <input type="hidden" name="restaurantId" value={r.id} />
                      <input type="hidden" name="photoId" value={photo.id} />
                      <Button type="submit" variant="ghost" size="sm">Удалить</Button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
