import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { PhoneInput } from '@/components/phone-input'
import { updateRestaurant } from '../../actions'
import { deleteRestaurantPhoto, reorderRestaurantPhoto, uploadRestaurantPhotos } from './photo-actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { RestaurantHoursFields } from '@/components/admin/restaurant-hours-fields'
import type { RestaurantHour } from '@/lib/opening-hours'

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
  public_url: string
  sort_order: number
}

export default async function AdminRestaurantEditPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { photoOk, photoError } = await searchParams
  const { supabase } = await requireAdmin()

  const [{ data: r }, { data: restaurantHours }, { data: primaryLocation }, { data: photos }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .single(),
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
      .select('id, public_url, sort_order')
      .eq('restaurant_id', id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<RestaurantPhoto[]>(),
  ])

  if (!r) notFound()

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Редактировать</h1>
        <div className="flex gap-2">
          <Button href={`/admin/restaurants/${r.id}/locations`} variant="secondary" size="sm">
            Адреса
          </Button>
          <Button href="/admin/restaurants" variant="ghost" size="sm">← Назад</Button>
        </div>
      </div>

      <Card>
        <form action={updateRestaurant} className="space-y-4">
          <input type="hidden" name="id" value={r.id} />
          <Input name="restaurant_name" label="Название" defaultValue={r.restaurant_name} required />
          <Input name="slug" label="Slug" defaultValue={r.slug} required />
          <Input name="address" label="Адрес" defaultValue={r.address} required />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input name="cuisine" label="Кухня" defaultValue={r.cuisine} required />
            <Input name="cuisine_2" label="Кухня 2" defaultValue={r.cuisine_2 ?? ''} placeholder="Опционально" />
            <Input name="cuisine_3" label="Кухня 3" defaultValue={r.cuisine_3 ?? ''} placeholder="Опционально" />
          </div>
          <Input name="short_description" label="Описание" defaultValue={r.short_description} required />
          <Input name="instagram_url" label="Instagram" defaultValue={r.instagram_url ?? ''} />
          <Input name="two_gis_url" label="2GIS" defaultValue={r.two_gis_url ?? ''} placeholder="Ссылка 2GIS" />
          <div>
            <label className="mb-1.5 block text-base font-medium text-gray-700">Телефон</label>
            <PhoneInput name="phone" defaultValue={r.phone ?? ''} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-colors focus:border-accent" />
          </div>
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
          Ошибка: {photoError}
        </div>
      ) : null}

      <Card className="mt-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Фотографии</h2>
          <p className="mt-1 text-base text-gray-500">Загрузка до 10 изображений за раз.</p>
        </div>

        <form action={uploadRestaurantPhotos} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="restaurantId" value={r.id} />
          <div className="flex-1">
            <label className="mb-1.5 block text-base font-medium text-gray-700">Выберите файлы</label>
            <input
              type="file"
              name="photos"
              accept="image/*"
              multiple
              className="block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
          </div>
          <Button type="submit" size="md">Загрузить</Button>
        </form>

        {!photos || photos.length === 0 ? (
          <EmptyState title="Фотографий пока нет" description="Загрузите первое фото заведения" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {photos.map((photo, index) => (
              <div key={photo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.public_url} alt={`Фото ${index + 1}`} className="h-full w-full object-cover" />
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
