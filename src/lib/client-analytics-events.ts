/** Клиентские события, которые принимает POST /api/track. */
// signup_completed, code_requested, code_redeemed пишет сервер (в /api/track не принимаются).
export const CLIENT_ANALYTICS_EVENTS = [
  'whatsapp_click',
  'offer_get_click',
  'offer_redeemed',
  'sort_mode_switch',
  'login_cta_click',
  'partner_cta_click',
  // PWA install funnel (см. комментарий в src/lib/pwa/install.ts).
  'pwa_prompt_shown',
  'pwa_prompt_accepted',
  'pwa_prompt_dismissed',
  'pwa_installed',
  'pwa_launch',
  'pwa_onboarding_skipped',
  // Web Push (см. src/lib/pwa/push.ts).
  'push_permission_granted',
  'push_permission_denied',
  'push_clicked',
] as const

export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number]

const ALLOWED = new Set<string>(CLIENT_ANALYTICS_EVENTS)

export function isClientAnalyticsEvent(name: string): name is ClientAnalyticsEventName {
  return ALLOWED.has(name)
}

const MAX_PARAM_KEYS = 20
const MAX_STRING_LEN = 200

/** Санитизация params перед записью в meta — только примитивы, без вложенных объектов. */
export function sanitizeAnalyticsParams(
  params: unknown,
): Record<string, string | number | boolean> | null {
  if (params == null || typeof params !== 'object' || Array.isArray(params)) {
    return null
  }

  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_PARAM_KEYS) break
    if (typeof key !== 'string' || key.length === 0 || key.length > 64) continue

    if (typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_STRING_LEN)
    }
  }

  return Object.keys(out).length > 0 ? out : null
}
