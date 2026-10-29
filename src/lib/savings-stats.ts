import { unstable_cache } from 'next/cache'
import type { City } from '@/lib/cities'
import { logServerError } from '@/lib/safe-errors'
import { createSupabasePublicClient } from '@/lib/supabase/public'

/** Меньше гостей — блок «Гости уже сэкономили» не показываем. */
export const SAVINGS_MIN_GUESTS = 50

export type SavingsStats = {
  totalSaved: number
  guests: number
  redemptions: number
}

type SavingsStatsRow = {
  total_saved: number | string | null
  guests: number | null
  redemptions: number | null
}

// Ошибка бросается внутри кэша, чтобы сбой не закэшировался на час.
const loadSavingsStats = unstable_cache(
  async (city: City | null): Promise<SavingsStats> => {
    const supabase = createSupabasePublicClient()
    const { data, error } = await supabase.rpc('get_savings_stats', { city_slug: city })
    if (error) throw new Error(error.message)
    const row = (Array.isArray(data) ? data[0] : data) as SavingsStatsRow | undefined
    if (!row) throw new Error('get_savings_stats returned no rows')
    return {
      totalSaved: Number(row.total_saved) || 0,
      guests: Number(row.guests) || 0,
      redemptions: Number(row.redemptions) || 0,
    }
  },
  ['savings-stats-v1'],
  { revalidate: 3600, tags: ['savings-stats'] },
)

export async function getSavingsStats(city: City | null = null): Promise<SavingsStats | null> {
  try {
    return await loadSavingsStats(city)
  } catch (error) {
    logServerError('savings-stats', error)
    return null
  }
}

/**
 * Статистика для блока на странице: по городу, если там уже достаточно гостей,
 * иначе по всем городам. null — блок не показываем (мало гостей или ошибка).
 */
export async function getDisplayedSavingsStats(city: City | null = null): Promise<SavingsStats | null> {
  if (city) {
    const cityStats = await getSavingsStats(city)
    if (cityStats && cityStats.guests >= SAVINGS_MIN_GUESTS) return cityStats
  }
  const total = await getSavingsStats(null)
  return total && total.guests >= SAVINGS_MIN_GUESTS ? total : null
}
