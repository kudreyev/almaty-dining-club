import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getFallbackByContext,
  getUserFacingError,
  logServerError,
} from '@/lib/safe-errors'

const RESTAURANT_PHOTO_BUCKET = 'restaurant-photos'
const MAX_FILES_PER_UPLOAD = 10

type RouteParams = {
  params: Promise<{ id: string }>
}

type RestaurantLite = {
  id: string
  slug: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function ensureAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { ok: false as const, response: jsonError('Требуется авторизация.', 401) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle<{ role: string | null }>()

  if (profileError) {
    logServerError('api/admin/photos/ensureAdmin', profileError)
    return { ok: false as const, response: jsonError(getFallbackByContext('auth'), 500) }
  }

  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, response: jsonError('Недостаточно прав.', 403) }
  }

  return { ok: true as const }
}

function buildStoragePath(restaurantId: string, kind: 'thumb' | 'full') {
  const timestamp = Date.now()
  const random = crypto.randomUUID()
  return `restaurants/${restaurantId}/${kind}-${timestamp}-${random}.webp`
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

async function ensurePhotoBucket(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: existingBucket, error: getBucketError } = await admin.storage.getBucket(RESTAURANT_PHOTO_BUCKET)

  if (existingBucket) return

  const bucketMissing =
    !!getBucketError && /not found|does not exist|bucket/i.test(getBucketError.message || '')

  if (!bucketMissing && getBucketError) {
    throw new Error(`Не удалось проверить bucket: ${getBucketError.message}`)
  }

  const { error: createBucketError } = await admin.storage.createBucket(RESTAURANT_PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: `${10 * 1024 * 1024}`,
    allowedMimeTypes: ['image/webp'],
  })

  if (createBucketError) {
    throw new Error(`Не удалось создать bucket для фото: ${createBucketError.message}`)
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const adminCheck = await ensureAdmin()
  if (!adminCheck.ok) return adminCheck.response

  const { id: restaurantId } = await params
  if (!restaurantId) {
    return jsonError('Не передан id заведения.')
  }

  const formData = await request.formData()
  const thumbs = formData.getAll('thumbs').filter((item): item is File => item instanceof File && item.size > 0)
  const fulls = formData.getAll('fulls').filter((item): item is File => item instanceof File && item.size > 0)

  if (thumbs.length === 0 || fulls.length === 0) {
    return jsonError('Не получены файлы для загрузки.')
  }
  if (thumbs.length !== fulls.length) {
    return jsonError('Нарушена структура данных загрузки.')
  }
  if (thumbs.length > MAX_FILES_PER_UPLOAD) {
    return jsonError(`За один раз можно загрузить не более ${MAX_FILES_PER_UPLOAD} файлов.`)
  }

  const admin = createSupabaseAdminClient()
  const uploadedPaths: string[] = []

  try {
    await ensurePhotoBucket(admin)
    const restaurant = await getRestaurantOrThrow(admin, restaurantId)
    const { data: lastPhoto, error: lastPhotoError } = await admin
      .from('restaurant_photos')
      .select('sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>()

    if (lastPhotoError) {
      throw new Error(`Не удалось определить порядок фото: ${lastPhotoError.message}`)
    }

    let nextSortOrder = (lastPhoto?.sort_order ?? -1) + 1

    for (let index = 0; index < thumbs.length; index += 1) {
      const thumbFile = thumbs[index]
      const fullFile = fulls[index]
      const thumbPath = buildStoragePath(restaurantId, 'thumb')
      const fullPath = buildStoragePath(restaurantId, 'full')

      const { error: thumbUploadError } = await admin.storage
        .from(RESTAURANT_PHOTO_BUCKET)
        .upload(thumbPath, await thumbFile.arrayBuffer(), {
          upsert: false,
          contentType: 'image/webp',
        })

      if (thumbUploadError) {
        throw new Error(`Не удалось загрузить превью: ${thumbUploadError.message}`)
      }
      uploadedPaths.push(thumbPath)

      const { error: fullUploadError } = await admin.storage
        .from(RESTAURANT_PHOTO_BUCKET)
        .upload(fullPath, await fullFile.arrayBuffer(), {
          upsert: false,
          contentType: 'image/webp',
        })

      if (fullUploadError) {
        throw new Error(`Не удалось загрузить полную версию: ${fullUploadError.message}`)
      }
      uploadedPaths.push(fullPath)

      const { data: thumbUrlData } = admin.storage.from(RESTAURANT_PHOTO_BUCKET).getPublicUrl(thumbPath)
      const { data: fullUrlData } = admin.storage.from(RESTAURANT_PHOTO_BUCKET).getPublicUrl(fullPath)

      const { error: insertError } = await admin.from('restaurant_photos').insert({
        restaurant_id: restaurantId,
        // Backward compatibility: some DBs still keep legacy NOT NULL columns.
        public_url: fullUrlData.publicUrl,
        storage_path: fullPath,
        thumb_url: thumbUrlData.publicUrl,
        full_url: fullUrlData.publicUrl,
        thumb_path: thumbPath,
        full_path: fullPath,
        sort_order: nextSortOrder,
        is_active: true,
      })

      if (insertError) {
        throw new Error(`Не удалось сохранить запись фото: ${insertError.message}`)
      }

      nextSortOrder += 1
    }

    revalidatePath('/')
    revalidatePath('/almaty')
    revalidatePath('/map')
    revalidatePath(`/r/${restaurant.slug}`)
    revalidatePath(`/admin/restaurants/${restaurant.id}/edit`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await admin.storage.from(RESTAURANT_PHOTO_BUCKET).remove(uploadedPaths)
    }
    logServerError('api/admin/photos/POST', error)
    return jsonError(
      getUserFacingError(error, getFallbackByContext('photo-upload')),
      500
    )
  }
}
