import type { NextFunction, Request, Response } from 'express'
import { env } from '@/common/config/env'
import { AuthService } from '@/modules/auth/auth.service'

const authService = new AuthService()

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies[env.SESSION_COOKIE_NAME] as string | undefined
  const user = await authService.getSessionUser(token)
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  req.userId = user.id
  req.userRole = user.role
  next()
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireUser(req, res, () => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' })
    }
    next()
  })
}
