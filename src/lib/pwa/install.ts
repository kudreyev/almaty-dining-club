/**
 * Логика предложения установки PWA: платформа, частота показов, визиты.
 * Чистые функции + обёртки над localStorage (всё в try/catch: приватный режим,
 * встроенные браузеры). Состояние дублируется в profiles (см. /api/pwa/state).
 */

export type InstallPlatform =
  /** Уже открыто как приложение (display-mode: standalone / navigator.standalone). */
  | 'standalone'
  /** Android: Chrome / Samsung / Edge и др. — системный диалог через beforeinstallprompt. */
  | 'android'
  /** iPhone/iPad Safari: инструкция «Поделиться → На экран „Домой“». */
  | 'ios-safari'
  /** iOS 16.4+, Chrome и другие браузеры: «Поделиться» в адресной строке. */
  | 'ios-other'
  /** Instagram, Facebook, TikTok, WhatsApp, Telegram и др. WebView: установка невозможна. */
  | 'inapp-android'
  | 'inapp-ios'
  | 'desktop'
  /** Старый iOS в стороннем браузере и прочее, где установить нельзя. */
  | 'unsupported'

export type InstallTrigger = 'code_redeemed' | 'after_code' | 'second_visit' | 'profile_menu'

const INAPP_RE =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|TikTok|musical_ly|Bytedance|BytedanceWebview|WhatsApp|Telegram|Snapchat|Line\/|; wv\)/i
const IOS_OTHER_BROWSER_RE = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//

export function isIosDevice(ua: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ притворяется Mac.
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

export function isIpad(ua: string, maxTouchPoints = 0): boolean {
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
}

export function iosVersion(ua: string): [number, number] | null {
  const match = ua.match(/OS (\d+)_(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

export function isInAppBrowser(ua: string): boolean {
  return INAPP_RE.test(ua)
}

export function detectInstallPlatform(env: {
  ua: string
  standalone: boolean
  maxTouchPoints?: number
}): InstallPlatform {
  const { ua, standalone } = env
  const touch = env.maxTouchPoints ?? 0
  if (standalone) return 'standalone'

  if (isIosDevice(ua, touch)) {
    if (isInAppBrowser(ua)) return 'inapp-ios'
    if (!IOS_OTHER_BROWSER_RE.test(ua)) return 'ios-safari'
    const version = iosVersion(ua)
    // Добавление на экран «Домой» из сторонних браузеров — с iOS 16.4.
    if (version && (version[0] > 16 || (version[0] === 16 && version[1] >= 4))) return 'ios-other'
    return 'unsupported'
  }

  if (/Android/i.test(ua)) {
    return isInAppBrowser(ua) ? 'inapp-android' : 'android'
  }

  if (/Mobile|Opera Mini|IEMobile/i.test(ua)) return 'unsupported'
  return 'desktop'
}

/** Ссылка, открывающая текущую страницу в Chrome из WebView на Android. */
export function androidChromeIntentUrl(href: string): string {
  const url = new URL(href)
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
}

// ---------------------------------------------------------------------------
// Частота показов
// ---------------------------------------------------------------------------

export const INSTALL_PROMPT_MAX_SHOWS = 3
export const INSTALL_PROMPT_PAUSE_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

export type InstallPromptState = {
  shownCount: number
  dismissedAt: number | null
  installed: boolean
}

export const EMPTY_PROMPT_STATE: InstallPromptState = {
  shownCount: 0,
  dismissedAt: null,
  installed: false,
}

/** Автоматический показ (не из меню профиля): не установлено, < 3 показов, 14 дней после отказа. */
export function canAutoShowInstallPrompt(state: InstallPromptState, now: number): boolean {
  if (state.installed) return false
  if (state.shownCount >= INSTALL_PROMPT_MAX_SHOWS) return false
  if (state.dismissedAt !== null && now - state.dismissedAt < INSTALL_PROMPT_PAUSE_DAYS * DAY_MS) {
    return false
  }
  return true
}

/** localStorage и профиль в Supabase: берём «более строгое» из двух. */
export function mergePromptState(
  local: InstallPromptState,
  server: Partial<InstallPromptState> | null,
): InstallPromptState {
  if (!server) return local
  const dismissed = [local.dismissedAt, server.dismissedAt ?? null].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  return {
    shownCount: Math.max(local.shownCount, server.shownCount ?? 0),
    dismissedAt: dismissed.length ? Math.max(...dismissed) : null,
    installed: local.installed || Boolean(server.installed),
  }
}

// ---------------------------------------------------------------------------
// Визиты: новый визит — если с прошлой активности прошло больше 30 минут
// ---------------------------------------------------------------------------

export const VISIT_GAP_MS = 30 * 60 * 1000

export function registerVisit(visits: number[], now: number): number[] {
  const last = visits.at(-1)
  if (last !== undefined && now - last < VISIT_GAP_MS) {
    return [...visits.slice(0, -1), now]
  }
  return [...visits, now].slice(-10)
}

/** Текущий визит — второй (или больше) за последние 7 дней. */
export function isRepeatVisitWithin7Days(visits: number[], now: number): boolean {
  return visits.filter((at) => now - at <= 7 * DAY_MS).length >= 2
}

// ---------------------------------------------------------------------------
// Push: мягкий экран
// ---------------------------------------------------------------------------

export const PUSH_SOFTASK_PAUSE_DAYS = 30

export function canShowPushSoftAsk(args: {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  platform: InstallPlatform
  dismissedAt: number | null
  redeemedOnce: boolean
  now: number
}): boolean {
  if (!args.supported || args.permission !== 'default') return false
  if (args.dismissedAt !== null && args.now - args.dismissedAt < PUSH_SOFTASK_PAUSE_DAYS * DAY_MS) {
    return false
  }
  // iPhone: push только в установленном приложении. Android: и без установки, но после погашения кода.
  if (args.platform === 'standalone') return true
  if (args.platform === 'android') return args.redeemedOnce
  return false
}

// ---------------------------------------------------------------------------
// Хранилище
// ---------------------------------------------------------------------------

export const PWA_STORAGE = {
  prompt: 'kc:pwa_prompt',
  visits: 'kc:visits',
  pushSoftAsk: 'kc:push_softask_dismissed_at',
  pushFirstLaunchAsked: 'kc:push_first_launch_asked',
  redeemedOnce: 'kc:redeemed_once',
  installSynced: 'kc:pwa_installed_synced',
  /** sessionStorage: код показан, предложить после ухода с экрана кода. */
  afterCode: 'kc:install_after_code',
  /** sessionStorage: за сессию показываем не больше одной панели. */
  sheetShown: 'kc:sheet_shown',
  sessionTracked: 'kc:pwa_session_tracked',
  /** Старый ключ (до 2026-10): «уже установлено». */
  legacyInstalled: 'kudaclub:pwa_installed',
} as const

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readStored(key: string, kind: 'local' | 'session' = 'local'): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string | null, kind: 'local' | 'session' = 'local') {
  try {
    const store = storage(kind)
    if (!store) return
    if (value === null) store.removeItem(key)
    else store.setItem(key, value)
  } catch {
    // приватный режим, переполнение — не критично
  }
}

export function readPromptState(): InstallPromptState {
  try {
    const raw = readStored(PWA_STORAGE.prompt)
    const parsed = raw ? (JSON.parse(raw) as Partial<InstallPromptState>) : {}
    return {
      shownCount: Number.isFinite(parsed.shownCount) ? Number(parsed.shownCount) : 0,
      dismissedAt: Number.isFinite(parsed.dismissedAt) ? Number(parsed.dismissedAt) : null,
      installed: parsed.installed === true || readStored(PWA_STORAGE.legacyInstalled) === '1',
    }
  } catch {
    return { ...EMPTY_PROMPT_STATE }
  }
}

export function writePromptState(state: InstallPromptState) {
  writeStored(PWA_STORAGE.prompt, JSON.stringify(state))
}

export function readVisits(): number[] {
  try {
    const parsed = JSON.parse(readStored(PWA_STORAGE.visits) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isFinite(v)) : []
  } catch {
    return []
  }
}

export function writeVisits(visits: number[]) {
  writeStored(PWA_STORAGE.visits, JSON.stringify(visits))
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
}

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
