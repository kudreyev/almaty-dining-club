const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function translitCyrillic(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')
}

export function slugifyOfferTitle(input: string): string {
  const transliterated = translitCyrillic(input)
  const normalized = transliterated
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

  return normalized || 'offer'
}

export function offerTypeSuffix(offerType: string): '2za1' | 'gift' {
  return offerType === '2for1' ? '2za1' : 'gift'
}

export function buildOfferKeyBase(offerTitle: string, offerType: string): string {
  return `${slugifyOfferTitle(offerTitle)}_${offerTypeSuffix(offerType)}`
}

