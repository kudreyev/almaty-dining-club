// POST /api/promo/validate
// Проверяет промокод без инкремента used_count. Возвращает цену первого платежа.

import { NextRequest, NextResponse } from 'next/server'
import { validatePromoCode } from '@/lib/promo-codes'
import { PRICE_KZT } from '@/lib/pricing'
import { logServerError, getUserFacingError, getFallbackByContext } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { code?: string }
    const code = typeof body.code === 'string' ? body.code : ''

    const result = await validatePromoCode(code, PRICE_KZT)

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message: result.message,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      code: result.code,
      applies_to: result.applies_to,
      campaign_tag: result.campaign_tag,
      first_amount: result.first_amount,
      recurrent_amount: result.recurrent_amount,
      base_amount: result.base_amount,
    })
  } catch (error) {
    logServerError('api/promo/validate', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server',
        message: getUserFacingError(error, getFallbackByContext('generic')),
      },
      { status: 500 },
    )
  }
}
