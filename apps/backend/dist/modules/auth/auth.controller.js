import { z } from 'zod';
import { env } from '@/common/config/env';
import { AuthService } from '@/modules/auth/auth.service';
const loginSchema = z.object({
    phone: z.string().min(8),
});
const authService = new AuthService();
export class AuthController {
    async login(req, res) {
        const body = loginSchema.parse(req.body);
        const result = await authService.loginByPhone(body.phone);
        res.cookie(env.SESSION_COOKIE_NAME, result.token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: env.SESSION_TTL_SECONDS * 1000,
            path: '/',
        });
        return res.status(200).json({
            ok: true,
            userId: result.userId,
            expiresAt: result.expiresAt.toISOString(),
        });
    }
    async me(req, res) {
        const token = req.cookies[env.SESSION_COOKIE_NAME];
        const session = await authService.resolveSession(token);
        if (!session) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }
        return res.status(200).json({
            ok: true,
            userId: session.userId,
            expiresAt: session.expiresAt,
        });
    }
    async logout(_req, res) {
        res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
        return res.status(200).json({ ok: true });
    }
}
