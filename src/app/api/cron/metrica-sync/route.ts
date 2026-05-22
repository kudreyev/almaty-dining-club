import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  fetchGoalBySourceDaily,
  fetchMetricaGoals,
  yesterdayAlmaty,
} from '@/lib/metrica-api'
import { logServerError } from '@/lib/safe-errors'

/**
 * Vercel Cron: ежедневный pull агрегатов целей из Яндекс.Метрики.
 *
 * Защита:
 * - Vercel автоматически шлёт header `Authorization: Bearer <CRON_SECRET>`.
 * - Любой запрос без корректного токена возвращает 401.
 *
 * Что делает:
 * 1. Тянет реестр целей через Management API, апсертит в `metrica_goals_registry`.
 * 2. Для каждой цели, отмеченной `is_tracked = true`, тянет данные за вчера
 *    с группировкой по параметру `source`.
 * 3. Апсертит строки в `metrica_goals_daily` (idempotent по PK).
 *
 * Возвращает JSON-сводку: { date, goals_synced, rows_upserted }.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const METRICA_COUNTER_ID = 109119099

// Список целей, которые синкаем. Если в Метрике появится новая цель с таким
// именем — добавьте её сюда. Цели, отсутствующие в Метрике, пропускаются с
// логом в server-side error (не падает весь sync).
const TRACKED_GOAL_NAMES = [
  'whatsapp_click',
  'subscribe_click_home',
  'trial_to_paid_click',
  'offer_get_click',
  'offer_redeemed',
  'subscription_activated',
  'sort_mode_switch',
] as const

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${cronSecret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized()

  const token = process.env.YANDEX_OAUTH_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'YANDEX_OAUTH_TOKEN env is not set' },
      { status: 500 },
    )
  }

  const date = yesterdayAlmaty()
  const admin = createSupabaseAdminClient()

  let goals
  try {
    goals = await fetchMetricaGoals(METRICA_COUNTER_ID, token)
  } catch (error) {
    logServerError('cron/metrica-sync:fetchGoals', error)
    return NextResponse.json(
      { error: 'Failed to fetch goals from Metrica' },
      { status: 502 },
    )
  }

  // Сопоставляем по identifier (conditions[].url), не по displayName.
  // Дубликаты (старые + новые цели с одним id) — берём с max goal_id.
  const trackedSet = new Set<string>(TRACKED_GOAL_NAMES)
  const registryByName = new Map<string, { goal_id: number; goal_name: string }>()
  for (const g of goals) {
    if (!g.identifier || !trackedSet.has(g.identifier)) continue
    const prev = registryByName.get(g.identifier)
    if (!prev || g.id > prev.goal_id) {
      registryByName.set(g.identifier, { goal_id: g.id, goal_name: g.identifier })
    }
  }
  const registryRows = [...registryByName.values()].map((r) => ({
    ...r,
    is_tracked: true,
  }))

  if (registryRows.length > 0) {
    const { error } = await admin
      .from('metrica_goals_registry')
      .upsert(registryRows, { onConflict: 'goal_name' })
    if (error) {
      logServerError('cron/metrica-sync:upsertRegistry', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const synced: Array<{ goal: string; rows: number }> = []
  const skipped: string[] = []

  for (const goal of registryRows) {
    try {
      const rows = await fetchGoalBySourceDaily({
        counterId: METRICA_COUNTER_ID,
        goalId: goal.goal_id,
        date,
        token,
      })

      if (rows.length === 0) {
        synced.push({ goal: goal.goal_name, rows: 0 })
        continue
      }

      const upsertRows = rows.map((r) => ({
        date,
        goal_name: goal.goal_name,
        source: r.source,
        visits: r.visits,
        achievements: r.achievements,
        computed_at: new Date().toISOString(),
      }))

      const { error } = await admin
        .from('metrica_goals_daily')
        .upsert(upsertRows, { onConflict: 'date,goal_name,source' })

      if (error) {
        logServerError(`cron/metrica-sync:upsert:${goal.goal_name}`, error)
        skipped.push(goal.goal_name)
        continue
      }

      synced.push({ goal: goal.goal_name, rows: rows.length })
    } catch (error) {
      logServerError(`cron/metrica-sync:fetch:${goal.goal_name}`, error)
      skipped.push(goal.goal_name)
    }
  }

  // Цели, которые мы хотели синкать, но их нет в Метрике (видимо, ещё не
  // заведены). Возвращаем в ответе — удобно при первом запуске.
  const knownIdentifiers = new Set(
    goals.map((g) => g.identifier).filter((id): id is string => Boolean(id)),
  )
  const missing = TRACKED_GOAL_NAMES.filter((name) => !knownIdentifiers.has(name))

  return NextResponse.json({
    date,
    counter_id: METRICA_COUNTER_ID,
    goals_synced: synced,
    goals_skipped_due_to_error: skipped,
    goals_missing_in_metrica: missing,
  })
}
