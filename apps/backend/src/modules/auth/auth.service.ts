import crypto from 'node:crypto'
import { env } from '@/common/config/env'
import { HttpError } from '@/common/errors/http-error'
import { authDebug } from '@/common/logger/auth-debug'
import { AuthRepository } from '@/modules/auth/auth.repository'

export class AuthService {
  constructor(private readonly authRepository = new AuthRepository()) {}

  private hashToken(raw: string) {
    return crypto
      .createHmac('sha256', env.SESSION_SECRET)
      .update(raw)
      .digest('hex')
  }

  async loginByPhone(phone: string) {
    const normalized = phone.trim()
    if (!normalized.startsWith('+')) {
      authDebug('login_rejected_invalid_phone', { phone })
      throw new HttpError(400, 'Phone must be in E.164 format')
    }

    let user = await this.authRepository.findUserByPhone(normalized)
    const createdUser = !user
    if (!user) {
      user = await this.authRepository.createUser(normalized)
    }

    const rawToken = crypto.randomBytes(32).toString('base64url')
    const tokenHash = this.hashToken(rawToken)
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000)
    await this.authRepository.insertSession({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    authDebug('login_session_created', {
      phone: normalized,
      userId: user.id,
      createdUser,
      expiresAt: expiresAt.toISOString(),
    })

    return {
      userId: user.id,
      token: rawToken,
      expiresAt,
    }
  }

  async resolveSession(rawToken: string | undefined) {
    if (!rawToken) {
      authDebug('resolve_session_missing_token')
      return null
    }
    const session = await this.authRepository.getSession(this.hashToken(rawToken))
    authDebug('resolve_session_result', {
      found: Boolean(session),
      userId: session?.userId ?? null,
      expiresAt: session?.expiresAt?.toISOString?.() ?? null,
    })
    return session ?? null
  }
}
