import crypto from 'node:crypto';
import { env } from '@/common/config/env';
import { HttpError } from '@/common/errors/http-error';
import { AuthRepository } from '@/modules/auth/auth.repository';
export class AuthService {
    authRepository;
    constructor(authRepository = new AuthRepository()) {
        this.authRepository = authRepository;
    }
    hashToken(raw) {
        return crypto
            .createHmac('sha256', env.SESSION_SECRET)
            .update(raw)
            .digest('hex');
    }
    async loginByPhone(phone) {
        const normalized = phone.trim();
        if (!normalized.startsWith('+')) {
            throw new HttpError(400, 'Phone must be in E.164 format');
        }
        let user = await this.authRepository.findUserByPhone(normalized);
        if (!user) {
            user = await this.authRepository.createUser(normalized);
        }
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = this.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);
        await this.authRepository.insertSession({
            userId: user.id,
            tokenHash,
            expiresAt,
        });
        return {
            userId: user.id,
            token: rawToken,
            expiresAt,
        };
    }
    async resolveSession(rawToken) {
        if (!rawToken)
            return null;
        const session = await this.authRepository.getSession(this.hashToken(rawToken));
        return session ?? null;
    }
}
