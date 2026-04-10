'use server'

import { cookies } from 'next/headers'
import { getServerApiBaseUrl } from '@/lib/api-base-url'
import { normalizeToE164Like } from '@/lib/kz-phone'
const WA_CHALLENGE_PHONE_COOKIE = 'wa_challenge_phone'

type VerifyWhatsAppCodeResult = {
  ok: boolean
  error?: string
}

type LoginResponse = {
  ok: boolean
  userId: string
  token: string
  cookieName: string
  ttlSeconds: number
  expiresAt: string
}

type SendWhatsAppLoginResult = {
  ok: boolean
  message?: string
  error?: string
}

async function setWhatsAppChallengeCookies(phoneE164: string) {
  const cookieStore = await cookies()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const secureCookies = siteUrl.startsWith('https://')
  const commonOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    // In production over plain HTTP (IP without TLS), Secure cookies are dropped by browser.
    secure: secureCookies,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  }

  cookieStore.set(WA_CHALLENGE_PHONE_COOKIE, phoneE164, commonOptions)
}

async function clearWhatsAppChallengeCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(WA_CHALLENGE_PHONE_COOKIE)
}

async function setSessionCookie(cookieName: string, token: string, ttlSeconds: number) {
  const cookieStore = await cookies()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const secureCookies = siteUrl.startsWith('https://')

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    path: '/',
    maxAge: ttlSeconds,
  })
}


export async function sendWhatsAppLogin(
  formData: FormData
): Promise<SendWhatsAppLoginResult> {
  const phoneRaw = String(formData.get('phone') || '').trim()
  const phone = normalizeToE164Like(phoneRaw)

  if (!phone) {
    return {
      ok: false,
      error: 'Введите корректный номер телефона (с кодом страны, например +7…).',
    }
  }

  try {
    await setWhatsAppChallengeCookies(phone)

    return {
      ok: true,
      message: 'Код отправлен (dev режим: валидация кода отключена).',
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return {
      ok: false,
      error: text,
    }
  }
}

export async function verifyWhatsAppLoginCode(
  formData: FormData
): Promise<VerifyWhatsAppCodeResult> {
  const cookieStore = await cookies()
  const phoneFromCookie = cookieStore.get(WA_CHALLENGE_PHONE_COOKIE)?.value ?? null
  const phoneFromForm = normalizeToE164Like(String(formData.get('phone') || '').trim())
  const phoneForLogin = phoneFromCookie ?? phoneFromForm

  if (!phoneForLogin) {
    return { ok: false, error: 'Сессия логина истекла. Повторите вход.' }
  }

  try {
    const response = await fetch(`${getServerApiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: phoneForLogin }),
      cache: 'no-store',
    })

    if (!response.ok) {
      await clearWhatsAppChallengeCookies()
      return { ok: false, error: 'Не удалось выполнить вход.' }
    }

    const payload = (await response.json()) as LoginResponse
    if (!payload.ok || !payload.token || !payload.cookieName || !payload.ttlSeconds) {
      await clearWhatsAppChallengeCookies()
      return { ok: false, error: 'Некорректный ответ сервера авторизации.' }
    }

    await setSessionCookie(payload.cookieName, payload.token, payload.ttlSeconds)
  } catch {
    await clearWhatsAppChallengeCookies()
    return { ok: false, error: 'Не удалось связаться с сервером авторизации.' }
  }

  await clearWhatsAppChallengeCookies()
  return { ok: true }
}
