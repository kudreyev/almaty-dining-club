// POST /api/admin/push/prepare — создать кампанию + метаданные для батч-отправки.

import { NextResponse } from 'next/server'
import { assertAdminApi } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { countPushSubscriptions } from '@/lib/messaging/push-messaging'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TITLE_MAX = 50
const BODY_MAX = 120

type Body = {
  title?: string
  body?: string
  url?: string
  segment?: 'all' | 'self'
}

export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi()
    if (!auth.ok) return auth.response
    const { user } = auth

    const json = (await request.json()) as Body

    const title = typeof json.title === 'string' ? json.title.trim() : ''
    const body = typeof json.body === 'string' ? json.body.trim() : ''
    const url = typeof json.url === 'string' ? json.url.trim() : ''
    const segment = json.segment === 'self' ? 'self' : 'all'

    if (!title || title.length > TITLE_MAX) {
      return NextResponse.json({ error: 'invalid_title' }, { status: 400 })
    }
    if (!body || body.length > BODY_MAX) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }
    if (!url.startsWith('/') || url.length > 500) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
    }
    if (!/^\/[a-zA-Z0-9/_\-?=&%.]*$/.test(url)) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
    }

    const db = createSupabaseAdminClient()

    let recipientEndpoints = 0
    if (segment === 'self') {
      const { count } = await db
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('subscriber_id', user.id)
      recipientEndpoints = count ?? 0
      if (recipientEndpoints === 0) {
        return NextResponse.json({ error: 'no_self_subscription' }, { status: 400 })
      }
    } else {
      recipientEndpoints = await countPushSubscriptions()
      if (recipientEndpoints === 0) {
        return NextResponse.json({ error: 'no_subscribers' }, { status: 400 })
      }
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: recentMass } = await db
      .from('push_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('segment', 'all')
      .gte('created_at', weekAgo)

    const { data: campaign, error } = await db
      .from('push_campaigns')
      .insert({
        title,
        body,
        url,
        segment,
        created_by: user.id,
        sent_count: 0,
        failed_count: 0,
        click_count: 0,
      })
      .select('id')
      .single()

    if (error || !campaign) {
      logServerError('api/admin/push/prepare', error)
      return NextResponse.json({ error: 'create_failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      campaignId: campaign.id as string,
      total: recipientEndpoints,
      recentMassCount: recentMass ?? 0,
      warnFrequent: (recentMass ?? 0) >= 2 && segment === 'all',
    })
  } catch (error) {
    logServerError('api/admin/push/prepare', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
