import crypto from 'node:crypto'
import { env } from '@/common/config/env'
import { HttpError } from '@/common/errors/http-error'
import { authDebug } from '@/common/logger/auth-debug'
import { sendWhatsAppVerificationCode } from '@/infrastructure/messaging/whatsapp'
import { AuthRepository } from '@/modules/auth/auth.repository'

export class AuthService {
  constructor(private readonly authRepository = new AuthRepository()) {}

  private hashToken(raw: string) {
    return crypto
      .createHmac('sha256', env.SESSION_SECRET)
      .update(raw)
      .digest('hex')
  }

  private hashOtp(phone: string, code: string) {
    return crypto
      .createHmac('sha256', env.WHATSAPP_LOGIN_CODE_SECRET)
      .update(`${phone}:${code}`)
      .digest('hex')
  }

  private generateOtpCode() {
    return `${crypto.randomInt(0, 1_000_000)}`.padStart(6, '0')
  }

  async requestWhatsAppCode(phone: string) {
    const normalized = phone.trim()
    if (!normalized.startsWith('+')) {
      authDebug('otp_request_rejected_invalid_phone', { phone })
      throw new HttpError(400, 'Phone must be in E.164 format')
    }

    const code = this.generateOtpCode()
    const expiresAt = new Date(Date.now() + env.OTP_CODE_TTL_SECONDS * 1000)
    const codeHash = this.hashOtp(normalized, code)

    await this.authRepository.revokeActiveChallenges(normalized)
    const challenge = await this.authRepository.insertLoginChallenge({
      phone: normalized,
      codeHash,
      expiresAt,
    })

    try {
      await sendWhatsAppVerificationCode(normalized, code)
    } catch (error) {
      await this.authRepository.revokeChallenge(challenge.id)
      authDebug('otp_request_send_failed', {
        phone: normalized,
        challengeId: challenge.id,
        error: error instanceof Error ? error.message : 'unknown',
      })
      throw error
    }

    authDebug('otp_request_sent', {
      phone: normalized,
      challengeId: challenge.id,
      expiresAt: expiresAt.toISOString(),
    })

    return { expiresAt }
  }

  async verifyWhatsAppCode(phone: string, code: string) {
    const normalizedPhone = phone.trim()
    const normalizedCode = code.replace(/\D/g, '').slice(0, 6)

    if (!normalizedPhone.startsWith('+')) {
      authDebug('otp_verify_rejected_invalid_phone', { phone })
      throw new HttpError(400, 'Phone must be in E.164 format')
    }
    if (normalizedCode.length !== 6) {
      authDebug('otp_verify_rejected_invalid_code_format', { phone: normalizedPhone })
      throw new HttpError(400, 'Verification code must be 6 digits')
    }

    const challenge = await this.authRepository.getActiveChallenge(normalizedPhone)
    if (!challenge) {
      authDebug('otp_verify_missing_challenge', { phone: normalizedPhone })
      throw new HttpError(400, 'Код не найден или истек. Запросите новый.')
    }

    if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
      await this.authRepository.revokeChallenge(challenge.id)
      authDebug('otp_verify_max_attempts_reached', {
        phone: normalizedPhone,
        challengeId: challenge.id,
      })
      throw new HttpError(400, 'Превышено число попыток. Запросите новый код.')
    }

    const expectedHash = this.hashOtp(normalizedPhone, normalizedCode)
    if (expectedHash !== challenge.codeHash) {
      const attempts = challenge.attempts + 1
      await this.authRepository.incrementChallengeAttempts(challenge.id, attempts)
      if (attempts >= env.OTP_MAX_ATTEMPTS) {
        await this.authRepository.revokeChallenge(challenge.id)
      }
      authDebug('otp_verify_invalid_code', {
        phone: normalizedPhone,
        challengeId: challenge.id,
        attempts,
      })
      throw new HttpError(400, 'Неверный код.')
    }

    await this.authRepository.consumeChallenge(challenge.id)
    authDebug('otp_verify_success', {
      phone: normalizedPhone,
      challengeId: challenge.id,
    })

    return this.loginByPhone(normalizedPhone)
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

  async getSessionUser(rawToken: string | undefined) {
    const session = await this.resolveSession(rawToken)
    if (!session) return null
    const user = await this.authRepository.findUserById(session.userId)
    if (!user) return null
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      expiresAt: session.expiresAt,
    }
  }
}
