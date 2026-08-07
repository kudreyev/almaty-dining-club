/**
 * Долгоживущая cookie-сессия для PWA.
 * maxAge совпадает с дефолтом @supabase/ssr (~400 дней).
 *
 * В Dashboard Supabase (Authentication → Sessions) критично:
 * - Time-box user sessions = OFF (иначе выкинет через N дней)
 * - Inactivity timeout = OFF (иначе выкинет после простоя)
 * Refresh token сам по себе бессрочный при работающем auto-refresh.
 */
export const SUPABASE_AUTH_COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60

export const supabaseAuthCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: SUPABASE_AUTH_COOKIE_MAX_AGE_SEC,
}
