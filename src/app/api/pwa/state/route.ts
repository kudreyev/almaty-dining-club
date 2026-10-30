// Состояние предложения установки PWA в профиле (дублирует localStorage, чтобы
// лимит «3 показа / пауза 14 дней» работал между браузерами одного гостя).
// GET  → { shownCount, dismissedAt, installed } или 401 для гостя без входа.
// POST { event: 'prompt_shown' | 'prompt_dismissed' | 'installed' } → то же.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EVENTS = new Set(['prompt_shown', 'prompt_dismissed', 'installed'])

type RpcState = {
  shown_count?: number | null
  dismissed_at?: string | null
  installed_at?: string | null
}

async function record(event: string) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('record_pwa_event', { p_event: event })
  if (error) {
    logServerError('api/pwa/state', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  const state = (data ?? {}) as RpcState
  const dismissedAt = state.dismissed_at ? Date.parse(state.dismissed_at) : null
  return NextResponse.json(
    {
      shownCount: state.shown_count ?? 0,
      dismissedAt: Number.isFinite(dismissedAt) ? dismissedAt : null,
      installed: Boolean(state.installed_at),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function GET() {
  try {
    return await record('get')
  } catch (error) {
    logServerError('api/pwa/state', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { event?: unknown }
    if (typeof body.event !== 'string' || !EVENTS.has(body.event)) {
      return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
    }
    return await record(body.event)
  } catch (error) {
    logServerError('api/pwa/state', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
