import type { Request, Response } from 'express'
import { z } from 'zod'
import { env } from '@/common/config/env'
import { AuthService } from '@/modules/auth/auth.service'

const loginSchema = z.object({
  phone: z.string().min(8),
})

const authService = new AuthService()

export class AuthController {
  async login(req: Request, res: Response) {
    const body = loginSchema.parse(req.body)
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
    const session = await authService.resolveSession(token)
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    return res.status(200).json({
      ok: true,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
    return res.status(200).json({ ok: true })
  }
}
