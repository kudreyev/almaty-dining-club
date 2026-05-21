/**
 * Многоступенчатая сортировка каталога заведений на главной.
 *
 * Уровни:
 *  1. Статус работы (открыто > закрыто) — никогда не нарушается.
 *  2. Режим сортировки внутри блока: distance | benefit.
 *  3. Бакеты (близкие значения = одна группа): 0.5 км для distance, 500 ₸ для benefit.
 *  4. Внутри бакета: детерминированный seeded shuffle + разброс по брендам.
 */

export type SortMode = 'distance' | 'benefit'

export type SortableItem = {
  id: string
  isOpen: boolean
  distanceKm: number | null
  maxBenefit: number
  brandKey: string
  /** Тай-брейк, обычно — имя ресторана. */
  tiebreaker: string
}

// ---------------------------------------------------------------------------
// PRNG: mulberry32 (32-битный, быстрый, детерминированный).
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(value: string): number {
  // Простая 32-битная свёртка (FNV-подобная).
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Дата YYYY-MM-DD в зоне Алматы (UTC+5, без DST). */
export function getDailySeedString(now: Date = new Date(), tz = 'Asia/Almaty'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Базовый компаратор по режиму.
// ---------------------------------------------------------------------------
function compareByMode(a: SortableItem, b: SortableItem, mode: SortMode): number {
  if (mode === 'distance') {
    const da = a.distanceKm
    const db = b.distanceKm
    const aHas = da !== null && Number.isFinite(da)
    const bHas = db !== null && Number.isFinite(db)
    if (aHas && bHas) {
      if (da !== db) return (da as number) - (db as number)
    } else if (aHas !== bHas) {
      // у кого нет координат — в конец блока
      return aHas ? -1 : 1
    }
  } else {
    if (a.maxBenefit !== b.maxBenefit) return b.maxBenefit - a.maxBenefit
  }
  return a.tiebreaker.localeCompare(b.tiebreaker, 'ru')
}

// ---------------------------------------------------------------------------
// Бакеты «близких значений» для группировки.
// ---------------------------------------------------------------------------
const DISTANCE_BUCKET_KM = 0.5
const BENEFIT_BUCKET_KZT = 500

function bucketKey(item: SortableItem, mode: SortMode): string {
  if (mode === 'distance') {
    if (item.distanceKm === null || !Number.isFinite(item.distanceKm)) return 'd:none'
    return `d:${Math.floor(item.distanceKm / DISTANCE_BUCKET_KM)}`
  }
  return `b:${Math.floor(item.maxBenefit / BENEFIT_BUCKET_KZT)}`
}

// ---------------------------------------------------------------------------
// Детерминированный shuffle (Fisher-Yates) с переданным RNG.
// ---------------------------------------------------------------------------
function shuffleWithRng<T>(list: T[], rng: () => number): T[] {
  const result = list.slice()
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ---------------------------------------------------------------------------
// Anti-adjacent: разброс одинаковых брендов внутри группы.
// ---------------------------------------------------------------------------
function spreadBrands<T extends { brandKey: string }>(items: T[]): T[] {
  if (items.length <= 2) return items.slice()

  const queue = items.slice()
  const out: T[] = []

  while (queue.length > 0) {
    const lastBrand = out.length > 0 ? out[out.length - 1].brandKey : null
    let idx = 0
    if (lastBrand !== null) {
      const found = queue.findIndex((it) => it.brandKey !== lastBrand)
      // Если все оставшиеся — того же бренда, добавляем как есть.
      if (found === -1) {
        out.push(...queue)
        queue.length = 0
        break
      }
      idx = found
    }
    out.push(queue[idx])
    queue.splice(idx, 1)
  }

  return out
}

// ---------------------------------------------------------------------------
// Основной pipeline.
// ---------------------------------------------------------------------------
function sortBlock(
  items: SortableItem[],
  mode: SortMode,
  seedString: string
): SortableItem[] {
  if (items.length === 0) return []

  const sorted = items.slice().sort((a, b) => compareByMode(a, b, mode))

  // Группируем последовательно: пока bucketKey совпадает с предыдущим.
  const groups: SortableItem[][] = []
  let currentKey: string | null = null
  for (const it of sorted) {
    const key = bucketKey(it, mode)
    if (key !== currentKey || groups.length === 0) {
      groups.push([])
      currentKey = key
    }
    groups[groups.length - 1].push(it)
  }

  // Внутри каждой группы: seeded shuffle + spreadBrands.
  // Seed строится из dailySeed + индекса группы, чтобы разные группы тасовались независимо
  // и порядок был детерминированным на сутки.
  const result: SortableItem[] = []
  groups.forEach((group, groupIdx) => {
    if (group.length === 1) {
      result.push(group[0])
      return
    }
    const seed = hashString(`${seedString}|${mode}|${groupIdx}`)
    const rng = mulberry32(seed)
    const shuffled = shuffleWithRng(group, rng)
    const spread = spreadBrands(shuffled)
    result.push(...spread)
  })

  return result
}

export type SortCatalogOptions = {
  mode: SortMode
  seed?: string
  now?: Date
}

/**
 * Возвращает отсортированный массив id в нужном порядке.
 * Уровень 1 (open/closed) не нарушается ничем.
 */
export function sortCatalog<T extends SortableItem>(
  items: T[],
  options: SortCatalogOptions
): T[] {
  const seed = options.seed ?? getDailySeedString(options.now)
  const opens = items.filter((it) => it.isOpen)
  const closeds = items.filter((it) => !it.isOpen)

  const openSorted = sortBlock(opens, options.mode, seed)
  const closedSorted = sortBlock(closeds, options.mode, seed)

  // sortBlock работает с SortableItem; нам нужно вернуть исходные T.
  // Так как T extends SortableItem и мы не клонируем элементы — ссылки сохраняются.
  return [...openSorted, ...closedSorted] as T[]
}
