import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { completeChat } from '@/lib/llm'
import { sendTelegramMessage } from '@/lib/telegram'
import {
  buildWeeklyDigestContext,
  buildWeeklyDigestPrompt,
  truncateForTelegram,
} from '@/lib/weekly-digest'
import { logServerError } from '@/lib/safe-errors'

/**
 * Vercel Cron: еженедельный LLM-digest в Telegram (Слой 4).
 * Понедельник 04:00 Алматы (0 23 * * 0 UTC).
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return unauthorized()

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY env is not set' }, { status: 500 })
  }

  let ctx
  try {
    ctx = await buildWeeklyDigestContext()
  } catch (error) {
    logServerError('cron/weekly-digest:context', error)
    return NextResponse.json({ error: 'Failed to build digest context' }, { status: 500 })
  }

  const prompt = buildWeeklyDigestPrompt(ctx)
  const digest = await completeChat(prompt)
  if (!digest) {
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }

  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
  )

  let telegramResult: Awaited<ReturnType<typeof sendTelegramMessage>> = {
    sent: false,
    reason: 'not_configured',
  }

  if (telegramConfigured) {
    const header = `📊 Kudaclub · недельный digest (до ${ctx.week_ending})\n\n`
    telegramResult = await sendTelegramMessage(truncateForTelegram(header + digest))
  }

  return NextResponse.json({
    week_ending: ctx.week_ending,
    snapshots_days: ctx.snapshots.length,
    digest_preview: digest.slice(0, 500),
    telegram: {
      configured: telegramConfigured,
      sent: telegramResult.sent,
    },
  })
}
