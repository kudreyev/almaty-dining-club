import type { Request, Response } from 'express'
import { z } from 'zod'
import { env } from '@/common/config/env'
import { authDebug } from '@/common/logger/auth-debug'
import { AuthService } from '@/modules/auth/auth.service'

const loginSchema = z.object({
  phone: z.string().min(8),
})

const verifyCodeSchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4),
})

const authService = new AuthService()

export class AuthController {
  async requestCode(req: Request, res: Response) {
    const body = loginSchema.parse(req.body)
    authDebug('otp_request_api', {
      requestId: req.requestId,
      phone: body.phone,
      host: req.header('host') ?? null,
    })
    const result = await authService.requestWhatsAppCode(body.phone)
    return res.status(200).json({
      ok: true,
      expiresAt: result.expiresAt.toISOString(),
    })
  }

  async verifyCode(req: Request, res: Response) {
    const body = verifyCodeSchema.parse(req.body)
    authDebug('otp_verify_api', {
      requestId: req.requestId,
      phone: body.phone,
      host: req.header('host') ?? null,
    })
    const result = await authService.verifyWhatsAppCode(body.phone, body.code)
    const secureCookie =
      typeof env.SESSION_COOKIE_SECURE === 'boolean'
        ? env.SESSION_COOKIE_SECURE
        : env.FRONTEND_URL.startsWith('https://')

    res.cookie(env.SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: env.SESSION_TTL_SECONDS * 1000,
      path: '/',
    })

    return res.status(200).json({
      ok: true,
      userId: result.userId,
      token: result.token,
      cookieName: env.SESSION_COOKIE_NAME,
      ttlSeconds: env.SESSION_TTL_SECONDS,
      expiresAt: result.expiresAt.toISOString(),
    })
  }

  async login(req: Request, res: Response) {
    const body = loginSchema.parse(req.body)
    authDebug('login_request', {
      requestId: req.requestId,
      phone: body.phone,
      origin: req.header('origin') ?? null,
      host: req.header('host') ?? null,
      forwardedProto: req.header('x-forwarded-proto') ?? null,
    })
    const result = await authService.loginByPhone(body.phone)
    const secureCookie =
      typeof env.SESSION_COOKIE_SECURE === 'boolean'
        ? env.SESSION_COOKIE_SECURE
        : env.FRONTEND_URL.startsWith('https://')

    res.cookie(env.SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: env.SESSION_TTL_SECONDS * 1000,
      path: '/',
    })

    authDebug('login_response', {
      requestId: req.requestId,
      userId: result.userId,
      secureCookie,
      cookieName: env.SESSION_COOKIE_NAME,
      expiresAt: result.expiresAt.toISOString(),
    })

    return res.status(200).json({
      ok: true,
      userId: result.userId,
      token: result.token,
      cookieName: env.SESSION_COOKIE_NAME,
      ttlSeconds: env.SESSION_TTL_SECONDS,
      expiresAt: result.expiresAt.toISOString(),
    })
  }

  async me(req: Request, res: Response) {
    const token = req.cookies[env.SESSION_COOKIE_NAME] as string | undefined
    authDebug('me_request', {
      requestId: req.requestId,
      hasCookie: Boolean(token),
      cookieName: env.SESSION_COOKIE_NAME,
      origin: req.header('origin') ?? null,
      host: req.header('host') ?? null,
    })
    const session = await authService.resolveSession(token)
    if (!session) {
      authDebug('me_unauthorized', {
        requestId: req.requestId,
      })
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    authDebug('me_authorized', {
      requestId: req.requestId,
      userId: session.userId,
      expiresAt: session.expiresAt.toISOString(),
    })
    return res.status(200).json({
      ok: true,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })
  }

  async logout(_req: Request, res: Response) {
    authDebug('logout_request', {
      cookieName: env.SESSION_COOKIE_NAME,
    })
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
    return res.status(200).json({ ok: true })
  }
}
