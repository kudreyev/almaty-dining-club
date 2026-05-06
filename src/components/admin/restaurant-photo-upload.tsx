'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { prepareRestaurantPhotoVariants } from '@/lib/image/client-image-variants'
import { getFallbackByContext, getUserFacingError } from '@/lib/safe-errors'

const MAX_FILES_PER_UPLOAD = 10

type RestaurantPhotoUploadProps = {
  restaurantId: string
}

function baseName(fileName: string, fallback: string) {
  const trimmed = fileName.trim()
  if (!trimmed) return fallback
  const parts = trimmed.split('.')
  parts.pop()
  return parts.join('.') || fallback
}

export function RestaurantPhotoUpload({ restaurantId }: RestaurantPhotoUploadProps) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const canSubmit = useMemo(() => files.length > 0 && files.length <= MAX_FILES_PER_UPLOAD && !isUploading, [files, isUploading])

  const onChangeFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? [])
    setFiles(nextFiles)
    setError(null)
    setStatus(null)
  }

  const onUpload = async () => {
    if (files.length === 0) {
      setError('Выберите хотя бы один файл.')
      return
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      setError(`За один раз можно загрузить не более ${MAX_FILES_PER_UPLOAD} файлов.`)
      return
    }

    setIsUploading(true)
    setError(null)
    setStatus('Подготавливаем изображения...')

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setStatus(`Обрабатываем файл ${index + 1} из ${files.length}...`)

        const prepared = await prepareRestaurantPhotoVariants(file)
        const cleanName = baseName(file.name, `photo-${index + 1}`)

        const formData = new FormData()
        formData.append('thumbs', prepared.thumb.blob, `${cleanName}-thumb.webp`)
        formData.append('fulls', prepared.full.blob, `${cleanName}-full.webp`)

        setStatus(`Загружаем файл ${index + 1} из ${files.length}...`)
        const response = await fetch(`/api/admin/restaurants/${restaurantId}/photos`, {
          method: 'POST',
          body: formData,
        })

        let errorMessage = ''
        let isOk = false

        const responseText = await response.text()
        if (responseText) {
          try {
            const json = JSON.parse(responseText) as { error?: string; ok?: boolean }
            isOk = Boolean(json.ok)
            errorMessage = json.error || ''
          } catch {
            errorMessage = responseText
          }
        }

        if (!response.ok || !isOk) {
          throw new Error(errorMessage || `Не удалось загрузить файл ${index + 1}.`)
        }
      }

      setStatus(null)
      router.replace(`/admin/restaurants/${restaurantId}/edit?photoOk=1`)
      router.refresh()
    } catch (uploadError) {
      setStatus(null)
      setError(getUserFacingError(uploadError, getFallbackByContext('photo-upload')))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-base font-medium text-gray-700">Выберите файлы</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          multiple
          onChange={onChangeFiles}
          className="block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        <p className="mt-1 text-sm text-gray-500">Выбрано: {files.length}</p>
      </div>

      {status ? (
        <p className="text-sm text-gray-600">{status}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      <Button type="button" size="md" onClick={onUpload} disabled={!canSubmit}>
        {isUploading ? 'Загрузка...' : 'Загрузить'}
      </Button>
    </div>
  )
}
