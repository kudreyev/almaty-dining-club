// Тикет «исправить номер» после оплаты → Telegram поддержке.

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      currentPhone?: string
      message?: string
    }
    const currentPhone =
      typeof body.currentPhone === 'string' ? body.currentPhone.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!message || message.length < 3) {
      return NextResponse.json(
        { ok: false, error: 'Опишите правильный номер.' },
        { status: 400 },
      )
    }

    await sendTelegramMessage(
      [
        'Тикет: исправить номер после оплаты',
        currentPhone ? `Текущий: ${currentPhone}` : null,
        `Сообщение: ${message.slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    logServerError('api/support/phone-fix', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
