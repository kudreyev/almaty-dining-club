import type { createSupabaseAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/** Исключает staff/test из продуктовых метрик. */
export type CustomerMetricsScope = {
  nonCustomerIds: string[]
  nonCustomerSet: Set<string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyUserIdExclusion: <T>(query: T) => T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applySubscriptionExclusion: <T>(query: T) => T
  filterUserRows: <T extends { user_id: string }>(rows: T[]) => T[]
  filterNullableUserRows: <T extends { user_id: string | null }>(rows: T[]) => T[]
}

export async function createCustomerMetricsScope(
  admin: AdminClient,
): Promise<CustomerMetricsScope> {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .in('user_kind', ['staff', 'test'])
  if (error) throw error

  const nonCustomerIds = (data ?? []).map((row) => row.id)
  const nonCustomerSet = new Set(nonCustomerIds)

  const inList =
    nonCustomerIds.length > 0 ? `(${nonCustomerIds.join(',')})` : null

  return {
    nonCustomerIds,
    nonCustomerSet,
    applyUserIdExclusion<T>(query: T): T {
      if (!inList) return query
      return (query as { not: (c: string, o: string, v: string) => T }).not(
        'user_id',
        'in',
        inList,
      )
    },
    applySubscriptionExclusion<T>(query: T): T {
      let q = (query as { neq: (c: string, v: string) => T }).neq('plan_type', 'staff')
      if (inList) {
        q = (q as { not: (c: string, o: string, v: string) => T }).not('user_id', 'in', inList)
      }
      return q
    },
    filterUserRows(rows) {
      if (nonCustomerSet.size === 0) return rows
      return rows.filter((row) => !nonCustomerSet.has(row.user_id))
    },
    filterNullableUserRows(rows) {
      if (nonCustomerSet.size === 0) return rows
      return rows.filter((row) => !row.user_id || !nonCustomerSet.has(row.user_id))
    },
  }
}
