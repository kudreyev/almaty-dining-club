import { NextResponse } from 'next/server'
import {
  isClientAnalyticsEvent,
  sanitizeAnalyticsParams,
} from '@/lib/client-analytics-events'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TrackBody = {
  event?: unknown
  params?: unknown
  page?: unknown
}

/**
 * Клиентский трекинг в analytics_events (Слой 2).
 * Параллельно с reachGoal в Метрике — даёт live-данные в Supabase без задержки API.
 */
export async function POST(req: Request) {
  let body: TrackBody
  try {
    body = (await req.json()) as TrackBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body.event !== 'string' || !isClientAnalyticsEvent(body.event)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const params = sanitizeAnalyticsParams(body.params)
  const page =
    typeof body.page === 'string' && body.page.length <= 500
      ? body.page
      : null

  const meta =
    params || page
      ? {
          ...(params ?? {}),
          ...(page ? { page } : {}),
        }
      : null

  let userId: string | null = null
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Анонимный клик — нормально.
  }

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.from('analytics_events').insert({
      event_name: body.event,
      user_id: userId,
      meta,
    })
    if (error) {
      logServerError('api/track:insert', error)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }
  } catch (error) {
    logServerError('api/track', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
