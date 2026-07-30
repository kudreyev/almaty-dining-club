// POST /api/checkout/start
// Сохраняет телефон в pending_checkouts (лид) и выдаёт httpOnly one_time_token.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  CHECKOUT_TOKEN_COOKIE,
  CHECKOUT_TOKEN_MAX_AGE_SEC,
  createPendingCheckout,
} from '@/lib/checkout/pending-checkouts'
import { parseUtmCookieValue, UTM_COOKIE_NAME } from '@/lib/utm'
import { validatePromoCode } from '@/lib/promo-codes'
import { PRICE_KZT } from '@/lib/pricing'
import { logServerError } from '@/lib/safe-errors'
import { getUserFacingError, getFallbackByContext } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      phone?: string
      source?: string
      promo_code?: string
    }
    const phoneRaw = typeof body.phone === 'string' ? body.phone : ''
    const source = typeof body.source === 'string' ? body.source : null
    const promoRaw =
      typeof body.promo_code === 'string' ? body.promo_code.trim() : ''

    let validatedPromoCode: string | null = null
    let firstAmount = PRICE_KZT
    let recurrentAmount = PRICE_KZT

    if (promoRaw) {
      const promo = await validatePromoCode(promoRaw, PRICE_KZT)
      if (!promo.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: promo.message,
            promo_error: promo.error,
          },
          { status: 400 },
        )
      }
      validatedPromoCode = promo.code
      firstAmount = promo.first_amount
      recurrentAmount = promo.recurrent_amount
    }

    const cookieStore = await cookies()
    const utm = parseUtmCookieValue(cookieStore.get(UTM_COOKIE_NAME)?.value)

    const { phone, existingAccount, token } = await createPendingCheckout({
      phoneRaw,
      utm,
      source,
      promoCode: validatedPromoCode,
    })

    cookieStore.set(CHECKOUT_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: CHECKOUT_TOKEN_MAX_AGE_SEC,
    })

    return NextResponse.json({
      ok: true,
      phone,
      existing_account: existingAccount,
      first_amount: firstAmount,
      recurrent_amount: recurrentAmount,
      promo_code: validatedPromoCode,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PHONE') {
      return NextResponse.json(
        { ok: false, error: 'Введите корректный номер телефона.' },
        { status: 400 },
      )
    }
    logServerError('api/checkout/start', error)
    return NextResponse.json(
      {
        ok: false,
        error: getUserFacingError(error, getFallbackByContext('generic')),
      },
      { status: 500 },
    )
  }
}
