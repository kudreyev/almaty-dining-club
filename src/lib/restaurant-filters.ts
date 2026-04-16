export type OfferType = '2for1' | 'compliment'

export type RestaurantFilters = {
  openNow: boolean
  offers: Set<OfferType>
  cuisines: Set<string>
}

export const DEFAULT_FILTERS: RestaurantFilters = {
  openNow: false,
  offers: new Set<OfferType>(),
  cuisines: new Set<string>(),
}

function parseCsv(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function parseFiltersFromSearchParams(sp: URLSearchParams): RestaurantFilters {
  const openNow =
    sp.get('open') === '1' ||
    sp.get('openNow') === '1'

  const offersRaw = sp.get('type') ?? sp.get('offer') ?? sp.get('offers') ?? ''
  const offers = new Set<OfferType>()
  for (const x of parseCsv(offersRaw)) {
    if (x === '2for1' || x === 'compliment') offers.add(x)
  }

  const cuisinesRaw = sp.get('cuisine') ?? sp.get('cuisines') ?? ''
  const cuisines = new Set(parseCsv(cuisinesRaw))

  return { openNow, offers, cuisines }
}

export function serializeFiltersToSearchParams(
  filters: RestaurantFilters,
  base?: URLSearchParams
): URLSearchParams {
  const sp = new URLSearchParams(base ? base.toString() : '')

  if (filters.openNow) sp.set('open', '1')
  else sp.delete('open')

  if (filters.offers.size > 0) sp.set('type', Array.from(filters.offers).join(','))
  else sp.delete('type')

  if (filters.cuisines.size > 0) sp.set('cuisine', Array.from(filters.cuisines).join(','))
  else sp.delete('cuisine')

  // Back-compat keys cleanup
  sp.delete('openNow')
  sp.delete('offer')
  sp.delete('offers')
  sp.delete('cuisines')

  return sp
}

export function hasAnyFilters(filters: RestaurantFilters): boolean {
  return filters.openNow || filters.offers.size > 0 || filters.cuisines.size > 0
}

