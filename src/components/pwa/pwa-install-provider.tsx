'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { trackGoal } from '@/lib/analytics-client'
import {
  detectPwaPlatform,
  isStandaloneDisplay,
  isMarkedInstalled,
  markInstalled,
  savePromptOutcome,
  setDismissCooldown,
  shouldTrackPwaLaunchThisSession,
  type BeforeInstallPromptEventLike,
  type PwaPlatform,
} from '@/lib/pwa/install'

type PwaInstallContextValue = {
  platform: PwaPlatform | 'other'
  installed: boolean
  /** Android/Chrome: событие beforeinstallprompt сохранено. */
  canNativePrompt: boolean
  /** iOS Safari: показываем инструкцию вместо native prompt. */
  canIosGuide: boolean
  promptNativeInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  markDismissed: () => void
  markAccepted: () => void
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState<PwaPlatform | 'other'>('other')

  useEffect(() => {
    setPlatform(detectPwaPlatform())

    const alreadyStandalone = isStandaloneDisplay()
    const alreadyMarked = isMarkedInstalled()
    if (alreadyStandalone || alreadyMarked) {
      setInstalled(true)
      if (alreadyStandalone && shouldTrackPwaLaunchThisSession()) {
        trackGoal('pwa_launch')
      }
    }

    const onBip = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEventLike)
    }

    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      markInstalled()
      savePromptOutcome('accepted')
      trackGoal('pwa_installed')
    }

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptNativeInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const
    const event = deferred
    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      savePromptOutcome(outcome)
      setDeferred(null)
      if (outcome === 'accepted') {
        markInstalled()
        setInstalled(true)
        trackGoal('pwa_prompt_accepted')
      } else {
        setDismissCooldown()
        trackGoal('pwa_prompt_dismissed')
      }
      return outcome
    } catch {
      setDeferred(null)
      return 'unavailable' as const
    }
  }, [deferred])

  const markDismissed = useCallback(() => {
    setDismissCooldown()
    savePromptOutcome('dismissed')
    trackGoal('pwa_prompt_dismissed')
  }, [])

  const markAccepted = useCallback(() => {
    // iOS: пользователь открыл инструкцию (аналог «принял» шаг).
    savePromptOutcome('accepted')
    trackGoal('pwa_prompt_accepted')
  }, [])

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      platform,
      installed,
      canNativePrompt: Boolean(deferred) && !installed,
      canIosGuide: platform === 'ios' && !installed,
      promptNativeInstall,
      markDismissed,
      markAccepted,
    }),
    [
      platform,
      installed,
      deferred,
      promptNativeInstall,
      markDismissed,
      markAccepted,
    ],
  )

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  )
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext)
  if (!ctx) {
    return {
      platform: 'other',
      installed: false,
      canNativePrompt: false,
      canIosGuide: false,
      promptNativeInstall: async () => 'unavailable',
      markDismissed: () => {},
      markAccepted: () => {},
    }
  }
  return ctx
}
