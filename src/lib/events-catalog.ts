import type { SupabaseClient } from '@supabase/supabase-js'

/** Restaurant IDs that have at least one active club offer (no event_id). */
export async function restaurant_is_club_partner_client(
  supabase: SupabaseClient,
  restaurantIds: string[],
): Promise<Set<string>> {
  const result = new Set<string>()
  if (restaurantIds.length === 0) return result

  const { data } = await supabase
    .from('offers')
    .select('restaurant_id')
    .in('restaurant_id', restaurantIds)
    .eq('is_active', true)
    .is('event_id', null)
    .in('offer_type', ['2for1', 'compliment'])

  for (const row of data ?? []) {
    result.add(row.restaurant_id)
  }
  return result
}
