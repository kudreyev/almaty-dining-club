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
import { logServerError } from '@/lib/safe-errors'
import { getUserFacingError, getFallbackByContext } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      phone?: string
      source?: string
    }
    const phoneRaw = typeof body.phone === 'string' ? body.phone : ''
    const source = typeof body.source === 'string' ? body.source : null

    const cookieStore = await cookies()
    const utm = parseUtmCookieValue(cookieStore.get(UTM_COOKIE_NAME)?.value)

    const { phone, existingAccount, token } = await createPendingCheckout({
      phoneRaw,
      utm,
      source,
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
