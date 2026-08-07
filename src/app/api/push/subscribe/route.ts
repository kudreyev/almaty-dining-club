// POST /api/push/subscribe — upsert Web Push подписки текущего залогиненного
// активного подписчика (profiles.id → push_subscriptions.subscriber_id).

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSubscriptionCurrentlyActive } from '@/lib/subscription'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  platform?: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('status, start_date, end_date')
      .eq('user_id', user.id)
      .in('status', ['active', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(1)

    const latest = subscriptions?.[0] ?? null
    if (!isSubscriptionCurrentlyActive(latest)) {
      return NextResponse.json({ error: 'subscription_required' }, { status: 403 })
    }

    const body = (await request.json()) as Body
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
    const p256dh =
      typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : ''
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : ''
    const platform =
      typeof body.platform === 'string' && body.platform.trim()
        ? body.platform.trim().slice(0, 32)
        : null

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
    }
    if (endpoint.length > 2048 || p256dh.length > 512 || auth.length > 512) {
      return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        subscriber_id: user.id,
        endpoint,
        p256dh,
        auth,
        platform,
      },
      { onConflict: 'endpoint' },
    )

    if (error) {
      logServerError('api/push/subscribe', error)
      return NextResponse.json({ error: 'save_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError('api/push/subscribe', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
