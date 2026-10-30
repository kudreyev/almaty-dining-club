/**
 * Клиентская часть Web Push: системный запрос только из обработчика нажатия
 * «Да, сообщать» (enablePush), синхронизация подписки с /api/push/subscribe.
 */

import { CITY_COOKIE } from '@/lib/cities'
import { readStored, writeStored } from '@/lib/pwa/install'

const SYNC_SESSION_KEY = 'kc:push_synced'

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

export function detectPushPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)) {
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
    'PushManager' in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_KEY?.trim())
  )
}

export function currentPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushApiSupported()) return 'unsupported'
  return Notification.permission
}

function currentCity(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CITY_COOKIE}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  const json = subscription.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      platform: detectPushPlatform(),
      city: currentCity(),
    }),
  })
  // 401: гость ещё не вошёл (например, в только что установленном приложении на iPhone) —
  // подписка останется в браузере и сохранится после входа (syncPushSubscription).
  return res.ok
}

/** Вызывать только из обработчика нажатия. */
export async function enablePush(): Promise<NotificationPermission | 'error'> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY?.trim()
  if (!publicKey || !isPushApiSupported()) return 'error'
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return permission
    const reg = await navigator.serviceWorker.ready
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }))
    if (await saveSubscription(subscription)) writeStored(SYNC_SESSION_KEY, '1', 'session')
    return 'granted'
  } catch {
    return 'error'
  }
}

/** Раз за сессию: если разрешение уже дано — освежить подписку на сервере (город, is_active, вход). */
export async function syncPushSubscription(): Promise<void> {
  if (currentPushPermission() !== 'granted') return
  if (readStored(SYNC_SESSION_KEY, 'session') === '1') return
  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return
    if (await saveSubscription(subscription)) writeStored(SYNC_SESSION_KEY, '1', 'session')
  } catch {
    // ignore
  }
}
