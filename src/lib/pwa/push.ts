/**
 * Клиентские хелперы Web Push + цели Метрики:
 *
 * | Goal                     | Когда                                      |
 * |--------------------------|--------------------------------------------|
 * | push_permission_granted  | Notification.permission = granted + subscribe ok |
 * | push_permission_denied   | permission = denied (после клика)          |
 * | push_clicked             | клик по пушу; params.campaign_id при наличии   |
 */

export const PUSH_STORAGE = {
  dismissUntil: 'kudaclub:push_dismiss_until',
} as const

/** 30 дней после denied / закрытия карточки. */
export const PUSH_DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function isPushDismissCooldownActive(now = Date.now()): boolean {
  const raw = readStorage(PUSH_STORAGE.dismissUntil)
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  return now < until
}

export function setPushDismissCooldown(now = Date.now()): void {
  writeStorage(PUSH_STORAGE.dismissUntil, String(now + PUSH_DISMISS_COOLDOWN_MS))
}

export function detectPushPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)) {
    return 'ios'
  }
  if (/Android/i.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop'
  return 'unknown'
}

export function isPushApiSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}
