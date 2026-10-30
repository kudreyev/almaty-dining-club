'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { trackPwa } from '@/lib/pwa/analytics'
import {
  EMPTY_PROMPT_STATE,
  PWA_STORAGE,
  canAutoShowInstallPrompt,
  detectInstallPlatform,
  isStandaloneDisplay,
  mergePromptState,
  readPromptState,
  readStored,
  writePromptState,
  writeStored,
  type BeforeInstallPromptEventLike,
  type InstallPlatform,
  type InstallPromptState,
} from '@/lib/pwa/install'

type ServerEvent = 'prompt_shown' | 'prompt_dismissed' | 'installed'

type InstallStateValue = {
  /** null до гидратации (на сервере платформа неизвестна). */
  platform: InstallPlatform | null
  standalone: boolean
  installed: boolean
  /** Android: сохранён beforeinstallprompt — можно вызвать системный диалог. */
  canNativePrompt: boolean
  /** null — ещё не знаем, вошёл ли гость. */
  loggedIn: boolean | null
  canAutoShow: () => boolean
  promptNative: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  recordShown: () => void
  recordDismissed: () => void
}

const InstallStateContext = createContext<InstallStateValue | null>(null)

const noopSubscribe = () => () => {}

function useClientPlatform(): InstallPlatform | null {
  return useSyncExternalStore(
    noopSubscribe,
    () =>
      detectInstallPlatform({
        ua: navigator.userAgent,
        standalone: isStandaloneDisplay(),
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
      }),
    () => null,
  )
}

function postServerEvent(event: ServerEvent) {
  fetch('/api/pwa/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {
    // профиль — вторичное хранилище, localStorage уже обновлён
  })
}

export function InstallStateProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const platform = useClientPlatform()
  const standalone = platform === 'standalone'
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null)
  const [installedEvent, setInstalledEvent] = useState(false)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [serverInstalled, setServerInstalled] = useState(false)
  const storedInstalled = useSyncExternalStore(
    noopSubscribe,
    () => readPromptState().installed,
    () => false,
  )
  const promptRef = useRef<InstallPromptState>(EMPTY_PROMPT_STATE)
  const promptLoadedRef = useRef(false)

  const getPromptState = useCallback(() => {
    if (!promptLoadedRef.current) {
      promptRef.current = readPromptState()
      promptLoadedRef.current = true
    }
    return promptRef.current
  }, [])

  const updatePromptState = useCallback(
    (patch: (prev: InstallPromptState) => InstallPromptState) => {
      promptRef.current = patch(getPromptState())
      writePromptState(promptRef.current)
    },
    [getPromptState],
  )

  const markInstalled = useCallback(() => {
    updatePromptState((prev) => ({ ...prev, installed: true }))
    if (readStored(PWA_STORAGE.installSynced) !== '1') {
      writeStored(PWA_STORAGE.installSynced, '1')
      postServerEvent('installed')
    }
  }, [updatePromptState])

  useEffect(() => {
    const onBip = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEventLike)
    }
    const onInstalled = () => {
      setDeferred(null)
      setInstalledEvent(true)
      markInstalled()
      trackPwa('pwa_installed', { platform: 'android' })
    }
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [markInstalled])

  // Запуск как приложение: pwa_session на каждый запуск, pwa_installed — один раз
  // (на iPhone события appinstalled нет, это единственный сигнал установки).
  useEffect(() => {
    if (!standalone) return
    if (readStored(PWA_STORAGE.sessionTracked, 'session') !== '1') {
      writeStored(PWA_STORAGE.sessionTracked, '1', 'session')
      trackPwa('pwa_session')
    }
    if (!getPromptState().installed) {
      trackPwa('pwa_installed', { platform: 'standalone_launch' })
    }
    markInstalled()
  }, [standalone, getPromptState, markInstalled])

  // Состояние из профиля; заодно узнаём, вошёл ли гость. Повторяем после входа.
  const loggedInRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (loggedInRef.current === true) return
    if (pathname?.startsWith('/login') || pathname?.startsWith('/auth')) return
    let cancelled = false
    fetch('/api/pwa/state', { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          loggedInRef.current = false
          setLoggedIn(false)
          return
        }
        if (!res.ok) return
        const server = (await res.json()) as Partial<InstallPromptState>
        promptRef.current = mergePromptState(getPromptState(), server)
        writePromptState(promptRef.current)
        if (promptRef.current.installed) {
          writeStored(PWA_STORAGE.installSynced, '1')
          setServerInstalled(true)
        }
        loggedInRef.current = true
        setLoggedIn(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname, getPromptState])

  const promptNative = useCallback(async () => {
    if (!deferred) return 'unavailable' as const
    const event = deferred
    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      setDeferred(null)
      return outcome
    } catch {
      setDeferred(null)
      return 'unavailable' as const
    }
  }, [deferred])

  const recordShown = useCallback(() => {
    updatePromptState((prev) => ({ ...prev, shownCount: prev.shownCount + 1 }))
    postServerEvent('prompt_shown')
  }, [updatePromptState])

  const recordDismissed = useCallback(() => {
    updatePromptState((prev) => ({ ...prev, dismissedAt: Date.now() }))
    postServerEvent('prompt_dismissed')
  }, [updatePromptState])

  const canAutoShow = useCallback(
    () => !standalone && canAutoShowInstallPrompt(getPromptState(), Date.now()),
    [standalone, getPromptState],
  )

  const installed = standalone || installedEvent || storedInstalled || serverInstalled

  const value = useMemo<InstallStateValue>(
    () => ({
      platform,
      standalone,
      installed,
      canNativePrompt: Boolean(deferred) && !installed,
      loggedIn,
      canAutoShow,
      promptNative,
      recordShown,
      recordDismissed,
    }),
    [platform, standalone, installed, deferred, loggedIn, canAutoShow, promptNative, recordShown, recordDismissed],
  )

  return <InstallStateContext.Provider value={value}>{children}</InstallStateContext.Provider>
}

export function useInstallState(): InstallStateValue {
  const ctx = useContext(InstallStateContext)
  if (ctx) return ctx
  return {
    platform: null,
    standalone: false,
    installed: false,
    canNativePrompt: false,
    loggedIn: null,
    canAutoShow: () => false,
    promptNative: async () => 'unavailable',
    recordShown: () => {},
    recordDismissed: () => {},
  }
}
