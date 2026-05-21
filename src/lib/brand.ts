/**
 * Определение бренда заведения для анти-соседства филиалов в каталоге.
 * Если в БД есть brand — используем его. Иначе извлекаем эвристикой из имени.
 */

type BrandSource = {
  restaurant_name: string
  brand?: string | null
}

// Разделители порядок имеет значение: длинные/специфические — раньше.
// «BAO Sushi & Noodles Bar в ТРЦ Mega Center» → «BAO Sushi & Noodles Bar»
// «Coffee Shake на Сейфуллина»                → «Coffee Shake»
const SPLITTERS: ReadonlyArray<string> = [
  ' в ТРЦ ',
  ' в ТЦ ',
  ' в ЖК ',
  ' на ',
  ' в ',
  ' — ',
  ' · ',
]

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function extractBrandFromName(name: string): string {
  const cleaned = normalize(name)
  if (!cleaned) return ''

  let earliestIdx = -1
  for (const splitter of SPLITTERS) {
    const idx = cleaned.indexOf(splitter)
    if (idx <= 0) continue
    if (earliestIdx === -1 || idx < earliestIdx) {
      earliestIdx = idx
    }
  }

  if (earliestIdx === -1) return cleaned
  return normalize(cleaned.slice(0, earliestIdx))
}

/**
 * Каноничный ключ бренда для группировки.
 * Бренд из БД имеет приоритет; если пустой — эвристика по имени.
 * Возвращаемый ключ лоукейсится для устойчивости.
 */
export function getBrandKey(source: BrandSource): string {
  const fromDb = source.brand ? normalize(source.brand) : ''
  const brand = fromDb || extractBrandFromName(source.restaurant_name)
  return brand.toLocaleLowerCase('ru')
}
