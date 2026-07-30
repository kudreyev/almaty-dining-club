// POST /api/checkout/complete
// Автологин только если Pay-вебхук пометил pending_checkout=paid.
// Колбэк виджета сам по себе сессию НЕ выдаёт.

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  CHECKOUT_TOKEN_COOKIE,
  findPendingCheckoutByToken,
  invalidateCheckoutToken,
  isCheckoutTokenValid,
} from '@/lib/checkout/pending-checkouts'
import { createSessionForPhone } from '@/lib/checkout/create-session'
import { logServerError } from '@/lib/safe-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(CHECKOUT_TOKEN_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ status: 'invalid' })
    }

    const row = await findPendingCheckoutByToken(token)
    if (!row || !isCheckoutTokenValid(row)) {
      return NextResponse.json({ status: 'invalid' })
    }

    if (row.status !== 'paid') {
      return NextResponse.json({
        status: 'pending',
        phone: row.phone,
        existing_account: row.existing_account,
      })
    }

    // Оплата на номер уже активного аккаунта — только OTP, без автосессии.
    if (row.existing_account) {
      await invalidateCheckoutToken(row.id)
      cookieStore.set(CHECKOUT_TOKEN_COOKIE, '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
      })
      return NextResponse.json({
        status: 'needs_otp',
        phone: row.phone,
      })
    }

    const { userId } = await createSessionForPhone(row.phone)
    await invalidateCheckoutToken(row.id)
    cookieStore.set(CHECKOUT_TOKEN_COOKIE, '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    })

    return NextResponse.json({
      status: 'authenticated',
      phone: row.phone,
      userId,
    })
  } catch (error) {
    logServerError('api/checkout/complete', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
