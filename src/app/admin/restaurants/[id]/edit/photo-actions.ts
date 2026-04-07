'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const RESTAURANT_PHOTO_BUCKET = 'restaurant-photos'
const MAX_FILES_PER_UPLOAD = 10

type RestaurantLite = {
  id: string
  slug: string
}

type RestaurantPhotoRow = {
  id: string
  sort_order: number
}

type ReorderDirection = 'up' | 'down'

function redirectToEditWithError(restaurantId: string, message: string): never {
  const basePath = restaurantId ? `/admin/restaurants/${restaurantId}/edit` : '/admin/restaurants'
  redirect(`${basePath}?photoError=${encodeURIComponent(message)}`)
}

function redirectToEditWithOk(restaurantId: string): never {
  const basePath = restaurantId ? `/admin/restaurants/${restaurantId}/edit` : '/admin/restaurants'
  redirect(`${basePath}?photoOk=1`)
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Не удалось выполнить операцию с фотографиями.'
}

function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'bin'
}

function buildStoragePath(restaurantId: string, file: File): string {
  const timestamp = Date.now()
  const random = crypto.randomUUID()
  return `restaurants/${restaurantId}/${timestamp}-${random}.${fileExtension(file)}`
}

async function getRestaurantOrThrow(admin: ReturnType<typeof createSupabaseAdminClient>, restaurantId: string) {
  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle<RestaurantLite>()

  if (error) throw new Error(`Не удалось получить заведение: ${error.message}`)
  if (!restaurant) throw new Error('Заведение не найдено.')
  return restaurant
}

async function revalidateRestaurantPhotoPages(restaurant: RestaurantLite) {
  revalidatePath('/')
  revalidatePath('/almaty')
  revalidatePath('/map')
  revalidatePath(`/r/${restaurant.slug}`)
  revalidatePath(`/admin/restaurants/${restaurant.id}/edit`)
}

export async function uploadRestaurantPhotos(formData: FormData) {
  await requireAdmin()

  const restaurantId = String(formData.get('restaurantId') || '').trim()
  if (!restaurantId) {
    redirect('/admin/restaurants?error=missing_restaurant_id')
  }

  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)

  if (files.length === 0) {
    redirectToEditWithError(restaurantId, 'Выберите хотя бы один файл.')
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    redirectToEditWithError(restaurantId, `За один раз можно загрузить не более ${MAX_FILES_PER_UPLOAD} файлов.`)
  }

  const admin = createSupabaseAdminClient()

  try {
    const restaurant = await getRestaurantOrThrow(admin, restaurantId)

    const { data: lastPhoto, error: lastPhotoError } = await admin
      .from('restaurant_photos')
      .select('sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>()

    if (lastPhotoError) throw new Error(`Не удалось определить порядок фото: ${lastPhotoError.message}`)

    let nextSortOrder = (lastPhoto?.sort_order ?? -1) + 1

    for (const file of files) {
      const storagePath = buildStoragePath(restaurantId, file)
      const content = await file.arrayBuffer()

      const { error: uploadError } = await admin.storage
        .from(RESTAURANT_PHOTO_BUCKET)
        .upload(storagePath, content, {
          upsert: false,
          contentType: file.type || undefined,
        })

      if (uploadError) throw new Error(`Ошибка загрузки "${file.name}": ${uploadError.message}`)

      const { data: publicUrlData } = admin.storage.from(RESTAURANT_PHOTO_BUCKET).getPublicUrl(storagePath)

      const { error: insertError } = await admin.from('restaurant_photos').insert({
        restaurant_id: restaurantId,
        storage_path: storagePath,
        public_url: publicUrlData.publicUrl,
        sort_order: nextSortOrder,
        is_active: true,
      })

      if (insertError) {
        await admin.storage.from(RESTAURANT_PHOTO_BUCKET).remove([storagePath])
        throw new Error(`Ошибка сохранения фото "${file.name}": ${insertError.message}`)
      }

      nextSortOrder += 1
    }

    await revalidateRestaurantPhotoPages(restaurant)
    redirectToEditWithOk(restaurantId)
  } catch (error) {
    redirectToEditWithError(restaurantId, toMessage(error))
  }
}

export async function deleteRestaurantPhoto(formData: FormData) {
  await requireAdmin()

  const restaurantId = String(formData.get('restaurantId') || '').trim()
  const photoId = String(formData.get('photoId') || '').trim()

  if (!restaurantId || !photoId) {
    redirectToEditWithError(restaurantId, 'Не хватает данных для удаления фото.')
  }

  const admin = createSupabaseAdminClient()

  try {
    const restaurant = await getRestaurantOrThrow(admin, restaurantId)

    const { data: photo, error: photoError } = await admin
      .from('restaurant_photos')
      .select('id, storage_path')
      .eq('id', photoId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle<{ id: string; storage_path: string }>()

    if (photoError) throw new Error(`Не удалось получить фото: ${photoError.message}`)
    if (!photo) throw new Error('Фото не найдено.')

    const { error: storageError } = await admin
      .storage
      .from(RESTAURANT_PHOTO_BUCKET)
      .remove([photo.storage_path])

    if (storageError) throw new Error(`Не удалось удалить файл из хранилища: ${storageError.message}`)

    const { error: deleteError } = await admin
      .from('restaurant_photos')
      .delete()
      .eq('id', photoId)
      .eq('restaurant_id', restaurantId)

    if (deleteError) throw new Error(`Не удалось удалить запись фото: ${deleteError.message}`)

    await revalidateRestaurantPhotoPages(restaurant)
    redirectToEditWithOk(restaurantId)
  } catch (error) {
    redirectToEditWithError(restaurantId, toMessage(error))
  }
}

export async function reorderRestaurantPhoto(formData: FormData) {
  await requireAdmin()

  const restaurantId = String(formData.get('restaurantId') || '').trim()
  const photoId = String(formData.get('photoId') || '').trim()
  const direction = String(formData.get('direction') || '') as ReorderDirection

  if (!restaurantId || !photoId || (direction !== 'up' && direction !== 'down')) {
    redirectToEditWithError(restaurantId, 'Не хватает данных для сортировки фото.')
  }

  const admin = createSupabaseAdminClient()

  try {
    const restaurant = await getRestaurantOrThrow(admin, restaurantId)
    const { data: photos, error: photosError } = await admin
      .from('restaurant_photos')
      .select('id, sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<RestaurantPhotoRow[]>()

    if (photosError) throw new Error(`Не удалось загрузить фото для сортировки: ${photosError.message}`)
    if (!photos || photos.length < 2) {
      redirectToEditWithOk(restaurantId)
    }

    const index = photos.findIndex((photo) => photo.id === photoId)
    if (index < 0) throw new Error('Фото для сортировки не найдено.')

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= photos.length) {
      redirectToEditWithOk(restaurantId)
    }

    const currentPhoto = photos[index]
    const targetPhoto = photos[targetIndex]
    const tempSortOrder = -1

    const { error: tempError } = await admin
      .from('restaurant_photos')
      .update({ sort_order: tempSortOrder })
      .eq('id', currentPhoto.id)
      .eq('restaurant_id', restaurantId)
    if (tempError) throw new Error(`Не удалось изменить порядок фото: ${tempError.message}`)

    const { error: targetError } = await admin
      .from('restaurant_photos')
      .update({ sort_order: currentPhoto.sort_order })
      .eq('id', targetPhoto.id)
      .eq('restaurant_id', restaurantId)
    if (targetError) throw new Error(`Не удалось изменить порядок фото: ${targetError.message}`)

    const { error: currentError } = await admin
      .from('restaurant_photos')
      .update({ sort_order: targetPhoto.sort_order })
      .eq('id', currentPhoto.id)
      .eq('restaurant_id', restaurantId)
    if (currentError) throw new Error(`Не удалось изменить порядок фото: ${currentError.message}`)

    await revalidateRestaurantPhotoPages(restaurant)
    redirectToEditWithOk(restaurantId)
  } catch (error) {
    redirectToEditWithError(restaurantId, toMessage(error))
  }
}
