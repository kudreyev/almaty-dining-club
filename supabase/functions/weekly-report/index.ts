// Еженедельный отчёт KudaClub в Telegram.
//
// Секреты Edge Function — те же имена, что в Vercel:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET
// Vercel env сюда сам не попадает: скопировать значения в
// Supabase → Edge Functions → Secrets. Новый бот не нужен.
//
// Расписание: pg_cron 0 4 * * 1 UTC (понедельник 09:00 Алматы).
// Обработчики команд бота не трогаем — только sendMessage.

import { createClient } from 'npm:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(req: Request): boolean {
  const secrets = [
    Deno.env.get('WEEKLY_REPORT_SECRET'),
    Deno.env.get('CRON_SECRET'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  ].filter((value): value is string => Boolean(value))

  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const headerSecret = (req.headers.get('x-weekly-report-secret') ?? '').trim()
  return secrets.some(
    (secret) => timingSafeEqual(auth, secret) || timingSafeEqual(headerSecret, secret),
  )
}

function chatIds(): string[] {
  const extra = Deno.env.get('REPORT_TELEGRAM_CHAT_IDS') ?? ''
  const main = Deno.env.get('TELEGRAM_CHAT_ID') ?? ''
  return `${main},${extra}`
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function formatInt(n: number): string {
  const abs = Math.abs(Math.round(n))
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return n < 0 ? `-${grouped}` : grouped
}

function formatSigned(n: number): string {
  const rounded = Math.round(n)
  if (rounded > 0) return `+${formatInt(rounded)}`
  if (rounded < 0) return formatInt(rounded)
  return '0'
}

function formatKzt(n: number): string {
  const value = Math.round(Number(n) || 0)
  if (Math.abs(value) >= 1_000_000) {
    const mln = value / 1_000_000
    const text =
      Math.abs(mln - Math.round(mln)) < 0.05
        ? `${Math.round(mln)}`
        : mln.toFixed(1).replace('.', ',')
    return `${text} млн ₸`
  }
  return `${formatInt(value)} ₸`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatGoalDate(iso: string): string {
  const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return String(iso)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`
}

const GOAL_LABELS: Record<string, string> = {
  registered: 'пользователи',
  weekly_active: 'активные',
  redemptions_30d: 'погашения 30 дн.',
  retention_m2_pct: 'удержание',
  active_venues: 'заведения',
}

// deno-lint-ignore no-explicit-any
function formatReport(report: any): string {
  const users = report.users ?? {}
  const activity = report.activity ?? {}
  const savings = report.savings ?? {}
  const venues = report.venues ?? {}
  const peak = report.peak
  const goals = report.goals ?? {}
  const lines = [
    `<b>KudaClub: неделя ${escapeHtml(String(report.week?.label ?? ''))}</b>`,
    `Пользователи: ${formatInt(Number(users.registered_total))} (${formatSigned(Number(users.new))} за неделю, было ${formatSigned(Number(users.new_prev))})`,
    `Активных за неделю: ${formatInt(Number(activity.weekly_active))} (${formatSigned(Number(activity.weekly_active) - Number(activity.weekly_active_prev))})`,
    `Погашений: ${formatInt(Number(activity.redemptions))} (${formatSigned(Number(activity.redemptions) - Number(activity.redemptions_prev))}) · за 30 дней: ${formatInt(Number(activity.redemptions_30d))}`,
    `Удержание во 2-м месяце: ${report.retention_m2_pct == null ? 'н/д' : `${formatInt(Math.round(Number(report.retention_m2_pct)))}%`}`,
    `Выгода гостей: ${formatKzt(Number(savings.week))} · всего ${formatKzt(Number(savings.lifetime))}`,
  ]

  if (Array.isArray(goals.items) && goals.items.length) {
    const parts = goals.items.map((item: { metric: string; pct: number | null }) => {
      const label = GOAL_LABELS[item.metric] ?? item.metric
      const pct = item.pct == null ? 'н/д' : `${formatInt(Math.round(Number(item.pct)))}%`
      return `${label} ${pct}`
    })
    lines.push(`Цели к ${formatGoalDate(String(goals.target_date ?? ''))}: ${parts.join(' · ')}`)
  }

  const top = (report.top_venues ?? []).slice(0, 5).map(
    (venue: { name: string; redemptions: number; new_guests: number }) => {
      const name = escapeHtml(String(venue.name))
      if (Number(venue.new_guests) > 0) {
        return `${name} ${formatInt(Number(venue.redemptions))} (${formatInt(Number(venue.new_guests))} новых)`
      }
      return `${name} ${formatInt(Number(venue.redemptions))}`
    },
  )
  lines.push(`Топ заведений: ${top.length ? top.join(' · ') : 'нет'}`)

  const zeroNames = (venues.zero_names ?? []).slice(0, 5).map((name: string) => escapeHtml(String(name)))
  const extra = (venues.zero_names ?? []).length > 5 ? ', ...' : ''
  if (Number(venues.zero_count) > 0) {
    lines.push(
      `Без погашений: ${formatInt(Number(venues.zero_count))} заведений (${zeroNames.join(', ')}${extra})`,
    )
  } else {
    lines.push('Без погашений: нет')
  }

  const channels = (report.channels?.combined ?? []).map(
    (row: { channel: string; count: number }) =>
      `${escapeHtml(String(row.channel))} ${formatInt(Number(row.count))}`,
  )
  lines.push(`Каналы: ${channels.length ? channels.join(' · ') : 'нет'}`)
  lines.push(`Пик: ${peak?.label ? escapeHtml(String(peak.label)) : 'нет данных'}`)
  return lines.join('\n')
}

async function sendTelegram(text: string, parseMode?: 'HTML'): Promise<{ sent: number; failed: number; errors: string[] }> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  const ids = chatIds()
  if (!token || ids.length === 0) {
    return { sent: 0, failed: ids.length || 1, errors: ['telegram_not_configured'] }
  }

  let sent = 0
  let failed = 0
  const errors: string[] = []
  for (const chatId of ids) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })
    if (res.ok) {
      sent += 1
    } else {
      failed += 1
      errors.push(`${chatId}:${res.status}`)
    }
  }
  return { sent, failed, errors }
}

async function sendError(message: string) {
  const text = `KudaClub: не удалось собрать еженедельный отчёт. ${message}`
  try {
    await sendTelegram(text)
  } catch {
    // already returning the original error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-weekly-report-secret',
      },
    })
  }

  if (!isAuthorized(req)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    await sendError('нет ключа сервиса')
    return json({ error: 'missing_service' }, 500)
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await admin.rpc('get_weekly_report')
    if (error || !data) {
      const detail = error?.message ?? 'empty_report'
      await sendError(detail)
      return json({ error: detail }, 500)
    }

    const text = formatReport(data)
    const telegram = await sendTelegram(text, 'HTML')
    if (telegram.sent === 0) {
      await sendError(telegram.errors.join(', ') || 'telegram_send_failed')
      return json({ error: 'telegram_send_failed', telegram }, 500)
    }

    return json({
      ok: true,
      week: data.week ?? null,
      telegram,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    await sendError(message)
    return json({ error: message }, 500)
  }
})
