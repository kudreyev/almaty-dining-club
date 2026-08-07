// POST /api/push/click — инкремент click_count кампании (публичный, с пуша).

import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as { campaignId?: string }
    const campaignId =
      typeof json.campaignId === 'string' ? json.campaignId.trim() : ''

    if (!UUID_RE.test(campaignId)) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }

    const db = createSupabaseAdminClient()
    const { data: row } = await db
      .from('push_campaigns')
      .select('click_count')
      .eq('id', campaignId)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ ok: true })
    }

    await db
      .from('push_campaigns')
      .update({ click_count: (row.click_count ?? 0) + 1 })
      .eq('id', campaignId)

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError('api/push/click', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
