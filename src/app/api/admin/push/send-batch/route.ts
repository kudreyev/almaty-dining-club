// POST /api/admin/push/send-batch — один батч (≤100) для кампании.

import { NextResponse } from 'next/server'
import { assertAdminApi } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  PUSH_SEND_BATCH_SIZE,
  sendPushBatch,
} from '@/lib/messaging/push-messaging'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  campaignId?: string
  offset?: number
}

export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi()
    if (!auth.ok) return auth.response
    const { user } = auth

    const json = (await request.json()) as Body
    const campaignId =
      typeof json.campaignId === 'string' ? json.campaignId.trim() : ''
    const offset =
      typeof json.offset === 'number' && json.offset >= 0
        ? Math.floor(json.offset)
        : 0

    if (!campaignId) {
      return NextResponse.json({ error: 'invalid_campaign' }, { status: 400 })
    }

    const db = createSupabaseAdminClient()
    const { data: campaign, error } = await db
      .from('push_campaigns')
      .select('id, title, body, url, segment, sent_count, failed_count')
      .eq('id', campaignId)
      .maybeSingle()

    if (error || !campaign) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const batch = await sendPushBatch({
      payload: {
        title: campaign.title,
        body: campaign.body,
        url: campaign.url,
        campaignId: campaign.id,
      },
      offset,
      limit: PUSH_SEND_BATCH_SIZE,
      subscriberId: campaign.segment === 'self' ? user.id : undefined,
    })

    const sentCount = (campaign.sent_count ?? 0) + batch.sent
    const failedCount =
      (campaign.failed_count ?? 0) + batch.failed + batch.gone

    await db
      .from('push_campaigns')
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq('id', campaignId)

    return NextResponse.json({
      ok: true,
      campaignId,
      batchSent: batch.sent,
      batchFailed: batch.failed + batch.gone,
      processed: batch.processed,
      nextOffset: batch.nextOffset,
      done: batch.done,
      total: batch.total,
      sentCount,
      failedCount,
    })
  } catch (error) {
    logServerError('api/admin/push/send-batch', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
