// GET /api/admin/push/meta — число подписок + mass-кампании за 7 дней.

import { NextResponse } from 'next/server'
import { assertAdminApi } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  countPushSubscriptions,
  countPushSubscribers,
} from '@/lib/messaging/push-messaging'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await assertAdminApi()
    if (!auth.ok) return auth.response
    const { user } = auth

    const db = createSupabaseAdminClient()

    const [endpoints, subscribers, selfRes, weekRes] = await Promise.all([
      countPushSubscriptions(),
      countPushSubscribers(),
      db
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('subscriber_id', user.id),
      db
        .from('push_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('segment', 'all')
        .gte(
          'created_at',
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ])

    return NextResponse.json({
      endpoints,
      subscribers,
      selfEndpoints: selfRes.count ?? 0,
      recentMassCount: weekRes.count ?? 0,
    })
  } catch (error) {
    logServerError('api/admin/push/meta', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
