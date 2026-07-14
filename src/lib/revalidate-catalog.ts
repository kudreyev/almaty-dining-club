import { revalidatePath } from 'next/cache'
import { CITIES } from '@/lib/cities'

/**
 * Ревалидирует публичные страницы каталога для всех городов
 * (список `/{city}` и карту `/{city}/map`) плюс корень.
 * Используется в админ-экшенах после изменения заведений/фото.
 */
export function revalidateCatalogPaths() {
  revalidatePath('/')
  for (const city of CITIES) {
    revalidatePath(`/${city}`)
    revalidatePath(`/${city}/map`)
  }
}
