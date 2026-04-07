const THUMB_MAX_WIDTH = 600
const FULL_MAX_SIDE = 1600
const THUMB_QUALITY = 0.72
const FULL_QUALITY = 0.8

type VariantResult = {
  blob: Blob
  width: number
  height: number
}

type PreparedRestaurantPhoto = {
  thumb: VariantResult
  full: VariantResult
}

function ensureBrowserSupport() {
  if (typeof window === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('Ваш браузер не поддерживает обработку изображений.')
  }
}

async function imageBitmapToWebpBlob(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<VariantResult> {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Не удалось получить контекст canvas для обработки изображения.')
  }

  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Не удалось сжать изображение в WebP.'))
          return
        }
        resolve(result)
      },
      'image/webp',
      quality
    )
  })

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
  }
}

function buildThumbSize(width: number, height: number) {
  if (width <= THUMB_MAX_WIDTH) return { width, height }
  const ratio = THUMB_MAX_WIDTH / width
  return {
    width: Math.round(width * ratio),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function buildFullSize(width: number, height: number) {
  const maxSide = Math.max(width, height)
  if (maxSide <= FULL_MAX_SIDE) return { width, height }
  const ratio = FULL_MAX_SIDE / maxSide
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

export async function prepareRestaurantPhotoVariants(file: File): Promise<PreparedRestaurantPhoto> {
  ensureBrowserSupport()

  const bitmap = await createImageBitmap(file)
  try {
    const thumbSize = buildThumbSize(bitmap.width, bitmap.height)
    const fullSize = buildFullSize(bitmap.width, bitmap.height)

    const [thumb, full] = await Promise.all([
      imageBitmapToWebpBlob(bitmap, thumbSize.width, thumbSize.height, THUMB_QUALITY),
      imageBitmapToWebpBlob(bitmap, fullSize.width, fullSize.height, FULL_QUALITY),
    ])

    return { thumb, full }
  } finally {
    bitmap.close()
  }
}
