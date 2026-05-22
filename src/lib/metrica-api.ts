/**
 * Клиент для Yandex.Metrica Reporting API v1 и Management API v1.
 * Используется из cron-роута `/api/cron/metrica-sync`.
 *
 * Документация:
 * - Reporting: https://yandex.ru/dev/metrika/doc/api2/api_v1/intro.html
 * - Management: https://yandex.ru/dev/metrika/doc/management-api/intro/about.html
 *
 * Токен берётся из env `YANDEX_OAUTH_TOKEN` — никогда не вставлять inline.
 */

const REPORTING_BASE = 'https://api-metrika.yandex.net/stat/v1/data'
const MANAGEMENT_BASE = 'https://api-metrika.yandex.net/management/v1'

export type MetricaGoal = {
  id: number
  /** Человекочитаемое название в UI Метрики. */
  displayName: string
  type: string
  /**
   * Идентификатор JavaScript-события (reachGoal).
   * В Management API лежит в conditions[].url, не в поле name.
   */
  identifier: string | null
}

type ManagementGoalRow = {
  id: number
  name: string
  type: string
  conditions?: Array<{ type?: string; url?: string }>
}

type ManagementGoalsResponse = {
  goals: ManagementGoalRow[]
}

/** Извлекает идентификатор JS-цели из conditions (type=action, url=whatsapp_click). */
export function extractGoalIdentifier(goal: ManagementGoalRow): string | null {
  if (goal.type !== 'action' || !goal.conditions?.length) return null
  const url = goal.conditions[0]?.url
  return typeof url === 'string' && url.length > 0 ? url : null
}

type ReportingResponse = {
  data: Array<{
    dimensions: Array<{ name?: string; id?: string | null }>
    metrics: number[]
  }>
  totals: number[]
  query: unknown
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `OAuth ${token}`,
    Accept: 'application/json',
  }
}

/** Возвращает все цели счётчика (включая автоцели). */
export async function fetchMetricaGoals(
  counterId: number,
  token: string,
): Promise<MetricaGoal[]> {
  const res = await fetch(`${MANAGEMENT_BASE}/counter/${counterId}/goals`, {
    headers: authHeaders(token),
  })
  if (!res.ok) {
    throw new Error(`Metrica Management API ${res.status}: ${await res.text()}`)
  }
  const body = (await res.json()) as ManagementGoalsResponse
  return body.goals.map((g) => ({
    id: g.id,
    displayName: g.name,
    type: g.type,
    identifier: extractGoalIdentifier(g),
  }))
}

/**
 * Достижения одной цели за интервал, разрезанные по значению параметра визита `source`.
 *
 * - `ym:s:goal<id>reaches` — число достижений цели.
 * - `ym:s:visits` — число визитов, в которых цель достигалась.
 * - `ym:s:paramsLevel1`, `paramsLevel2` — первые два уровня ключа параметра
 *   (для reachGoal('whatsapp_click', { source: 'home-hero' }) это будет
 *   'source' и 'home-hero').
 *
 * Возвращает массив строк `(source, achievements, visits)`. `source` = '' если
 * цель достигнута без передачи параметра.
 */
export async function fetchGoalBySourceDaily(args: {
  counterId: number
  goalId: number
  date: string // YYYY-MM-DD
  token: string
}): Promise<Array<{ source: string; achievements: number; visits: number }>> {
  const { counterId, goalId, date, token } = args

  const url = new URL(REPORTING_BASE)
  url.searchParams.set('ids', String(counterId))
  url.searchParams.set(
    'metrics',
    `ym:s:goal${goalId}reaches,ym:s:goal${goalId}visits`,
  )
  url.searchParams.set('dimensions', 'ym:s:paramsLevel1,ym:s:paramsLevel2')
  url.searchParams.set('date1', date)
  url.searchParams.set('date2', date)
  url.searchParams.set('filters', `ym:s:goal==${goalId}`)
  url.searchParams.set('limit', '1000')
  url.searchParams.set('accuracy', 'full')

  const res = await fetch(url, { headers: authHeaders(token) })
  if (!res.ok) {
    throw new Error(`Metrica Reporting API ${res.status}: ${await res.text()}`)
  }
  const body = (await res.json()) as ReportingResponse

  // paramsLevel1 — это имя параметра ('source'), paramsLevel2 — значение.
  // Группируем по значению paramsLevel2, считая только paramsLevel1 = 'source'.
  // Достижения без параметра попадают в строки с paramsLevel1 = null.
  const bySource = new Map<string, { achievements: number; visits: number }>()
  let noParamAchievements = 0
  let noParamVisits = 0

  for (const row of body.data) {
    const param = row.dimensions[0]?.id ?? row.dimensions[0]?.name ?? null
    const value = row.dimensions[1]?.id ?? row.dimensions[1]?.name ?? null
    const [reaches, visits] = row.metrics

    if (param === null && value === null) {
      noParamAchievements += Math.round(reaches)
      noParamVisits += Math.round(visits)
      continue
    }

    if (param !== 'source' || value === null) continue

    const prev = bySource.get(value) ?? { achievements: 0, visits: 0 }
    bySource.set(value, {
      achievements: prev.achievements + Math.round(reaches),
      visits: prev.visits + Math.round(visits),
    })
  }

  const rows: Array<{ source: string; achievements: number; visits: number }> = []
  for (const [source, m] of bySource) {
    rows.push({ source, achievements: m.achievements, visits: m.visits })
  }
  if (noParamAchievements > 0) {
    rows.push({
      source: '',
      achievements: noParamAchievements,
      visits: noParamVisits,
    })
  }
  return rows
}

/**
 * Yesterday в часовом поясе Алматы (UTC+5). Метрика отдаёт данные за
 * закрытые сутки — обычно беремcя за `сегодня - 1`.
 */
export function yesterdayAlmaty(): string {
  const now = new Date()
  // Алматы стабильно UTC+5 круглый год (нет DST).
  const almatyMs = now.getTime() + 5 * 60 * 60 * 1000
  const almaty = new Date(almatyMs)
  almaty.setUTCDate(almaty.getUTCDate() - 1)
  return almaty.toISOString().slice(0, 10)
}
