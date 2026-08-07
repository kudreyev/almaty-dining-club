/**
 * Цели Яндекс.Метрики для PWA-установки (завести в интерфейсе Метрики):
 *
 * | Goal                  | Когда                                      | Params              |
 * |-----------------------|--------------------------------------------|---------------------|
 * | pwa_prompt_shown      | Показали карточку предложения установки    | platform: android\|ios |
 * | pwa_prompt_accepted   | Android: accepted в prompt(); iOS: нажал «Добавить» (открыл шторку) | — |
 * | pwa_prompt_dismissed  | Закрыл баннер (X) / dismissed системного диалога Android | — |
 * | pwa_installed         | Событие appinstalled (Android/Chrome)      | — |
 * | pwa_launch            | Заход в standalone (раз в сессию вкладки)  | — |
 */

export const PWA_METRICA_GOALS = [
  'pwa_prompt_shown',
  'pwa_prompt_accepted',
  'pwa_prompt_dismissed',
  'pwa_installed',
  'pwa_launch',
] as const

export type PwaMetricaGoal = (typeof PWA_METRICA_GOALS)[number]

export type PwaPlatform = 'android' | 'ios'

export const PWA_STORAGE = {
  installed: 'kudaclub:pwa_installed',
  dismissUntil: 'kudaclub:pwa_dismiss_until',
  promptOutcome: 'kudaclub:pwa_prompt_outcome',
  meVisits: 'kudaclub:pwa_me_visits',
  launchSession: 'kudaclub:pwa_launch_session',
} as const

/** 14 дней кулдауна после отказа / закрытия баннера. */
export const PWA_DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as (Navigator & { standalone?: boolean }) | undefined
  if (nav?.standalone === true) return true
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

/** iOS Safari / iPhone / iPad (включая iPadOS desktop UA). */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = ua.includes('Mac') && 'ontouchend' in document
  if (!iOS && !iPadOs) return false
  // Исключаем Chrome/Firefox/Edge на iOS — у них свой install UX.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return !isOtherBrowser
}

export function detectPwaPlatform(): PwaPlatform | 'other' {
  if (typeof window === 'undefined') return 'other'
  if (isIosSafari()) return 'ios'
  const ua = window.navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  return 'other'
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
    // private mode etc.
  }
}

export function isMarkedInstalled(): boolean {
  return readStorage(PWA_STORAGE.installed) === '1'
}

export function markInstalled(): void {
  writeStorage(PWA_STORAGE.installed, '1')
}

export function isDismissCooldownActive(now = Date.now()): boolean {
  const raw = readStorage(PWA_STORAGE.dismissUntil)
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  return now < until
}

export function setDismissCooldown(now = Date.now()): void {
  writeStorage(PWA_STORAGE.dismissUntil, String(now + PWA_DISMISS_COOLDOWN_MS))
}

export function clearDismissCooldown(): void {
  try {
    window.localStorage.removeItem(PWA_STORAGE.dismissUntil)
  } catch {
    // ignore
  }
}

export function savePromptOutcome(outcome: 'accepted' | 'dismissed'): void {
  writeStorage(PWA_STORAGE.promptOutcome, outcome)
}

/** Инкремент визитов /app/me. Возвращает новое значение (≥ 1). */
export function incrementMeVisitCount(): number {
  const prev = Number(readStorage(PWA_STORAGE.meVisits) || 0)
  const next = (Number.isFinite(prev) ? prev : 0) + 1
  writeStorage(PWA_STORAGE.meVisits, String(next))
  return next
}

export function getMeVisitCount(): number {
  const n = Number(readStorage(PWA_STORAGE.meVisits) || 0)
  return Number.isFinite(n) ? n : 0
}

/** Раз в sessionStorage (вкладка). true = нужно отправить pwa_launch. */
export function shouldTrackPwaLaunchThisSession(): boolean {
  try {
    if (sessionStorage.getItem(PWA_STORAGE.launchSession) === '1') return false
    sessionStorage.setItem(PWA_STORAGE.launchSession, '1')
    return true
  } catch {
    return true
  }
}

export function shouldOfferPwaInstall(args: {
  installed: boolean
  now?: number
}): boolean {
  if (args.installed) return false
  if (isStandaloneDisplay()) return false
  if (isMarkedInstalled()) return false
  if (isDismissCooldownActive(args.now)) return false
  return true
}
