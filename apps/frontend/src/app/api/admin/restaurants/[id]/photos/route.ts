import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { backendFetch } from '@/lib/backend-api'

const MAX_FILES_PER_UPLOAD = 10

type RouteParams = {
  params: Promise<{ id: string }>
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function fileToBase64(file: File) {
  return Buffer.from(await file.arrayBuffer()).toString('base64')
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: restaurantId } = await params
  if (!restaurantId) return jsonError('Не передан id заведения.')

  const formData = await request.formData()
  const thumbs = formData.getAll('thumbs').filter((item): item is File => item instanceof File && item.size > 0)
  const fulls = formData.getAll('fulls').filter((item): item is File => item instanceof File && item.size > 0)

  if (thumbs.length === 0 || fulls.length === 0) return jsonError('Не получены файлы для загрузки.')
  if (thumbs.length !== fulls.length) return jsonError('Нарушена структура данных загрузки.')
  if (thumbs.length > MAX_FILES_PER_UPLOAD) {
    return jsonError(`За один раз можно загрузить не более ${MAX_FILES_PER_UPLOAD} файлов.`)
  }

  const files = await Promise.all(
    thumbs.map(async (thumb, index) => ({
      thumbBase64: await fileToBase64(thumb),
      fullBase64: await fileToBase64(fulls[index]),
    }))
  )

  const response = await backendFetch(`/api/restaurants/admin/${encodeURIComponent(restaurantId)}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean
    data?: { restaurant?: { id: string; slug: string } }
    error?: string
  } | null

  if (!response.ok || !payload?.ok) {
    return jsonError(payload?.error ?? 'Ошибка при загрузке фотографий.', response.status || 500)
  }

  const restaurant = payload.data?.restaurant
  revalidatePath('/')
  revalidatePath('/almaty')
  revalidatePath('/map')
  if (restaurant?.slug) revalidatePath(`/r/${restaurant.slug}`)
  if (restaurant?.id) revalidatePath(`/admin/restaurants/${restaurant.id}/edit`)

  return NextResponse.json({ ok: true })
}
