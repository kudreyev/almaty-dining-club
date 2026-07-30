// Pay-уведомление: приходит после КАЖДОГО успешного платежа —
// и установочного (первая оплата через виджет), и каждого рекуррентного списания.
// Это единственный надёжный источник правды об оплате. Не активируйте подписку
// по коллбэку виджета на фронте — только здесь.
//
// Параллельный URL для ЛК TipTop: /api/webhooks/ttp/pay (тот же ledger + product).

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, parseWebhookBody } from '@/lib/tiptoppay'
import { logServerError } from '@/lib/safe-errors'
import { fulfillSuccessfulPay } from '@/lib/checkout/fulfill-pay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyWebhook(rawBody, req.headers.get('Content-HMAC'))) {
    return NextResponse.json({ code: 13 }, { status: 401 })
  }

  const p = parseWebhookBody(rawBody)

  try {
    await fulfillSuccessfulPay(p)
  } catch (error) {
    logServerError('api/tiptoppay/pay', error)
    return NextResponse.json({ code: 13 }, { status: 500 })
  }

  return NextResponse.json({ code: 0 })
}
