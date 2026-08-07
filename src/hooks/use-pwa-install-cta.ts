'use client'

/**
 * Общий CTA установки PWA (Android prompt / iOS-шторка).
 * Используют онбординг, баннер кабинета и пункт меню — без дублирования механики.
 */

import { useCallback, useState } from 'react'
import { usePwaInstall } from '@/components/pwa/pwa-install-provider'
import {
  setDismissCooldown,
  shouldOfferPwaInstall,
  type PwaPlatform,
} from '@/lib/pwa/install'
import { trackGoal } from '@/lib/analytics-client'

export type PwaInstallPlacement =
  | 'onboarding'
  | 'cabinet'
  | 'cabinet_menu'
  | 'payment_success'

type Options = {
  placement: PwaInstallPlacement
  /** Игнорировать кулдаун (меню / онбординг). */
  ignoreCooldown?: boolean
}

export function usePwaInstallCta(options: Options) {
  const {
    platform,
    installed,
    canNativePrompt,
    canIosGuide,
    promptNativeInstall,
    markDismissed,
    markAccepted,
  } = usePwaInstall()

  const [iosGuideOpen, setIosGuideOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const installPlatform: PwaPlatform | null =
    platform === 'ios' || platform === 'android' ? platform : null

  const baseOk =
    Boolean(installPlatform) &&
    !installed &&
    (options.ignoreCooldown
      ? !installed
      : shouldOfferPwaInstall({ installed }))

  // Android без bip ещё — для меню/онбординга всё равно показываем вход;
  // для баннера ждём canNativePrompt.
  const platformReady =
    installPlatform === 'ios'
      ? canIosGuide
      : options.ignoreCooldown
        ? true
        : canNativePrompt

  const canShow = baseOk && platformReady && Boolean(installPlatform)

  const trackShown = useCallback(() => {
    if (!installPlatform) return
    trackGoal('pwa_prompt_shown', {
      platform: installPlatform,
      placement: options.placement,
    })
  }, [installPlatform, options.placement])

  const startInstall = useCallback(async () => {
    if (!installPlatform) return 'unavailable' as const

    if (installPlatform === 'ios') {
      markAccepted()
      setIosGuideOpen(true)
      return 'ios_guide' as const
    }

    setBusy(true)
    try {
      return await promptNativeInstall()
    } finally {
      setBusy(false)
    }
  }, [installPlatform, markAccepted, promptNativeInstall])

  const closeIosGuide = useCallback(() => {
    setIosGuideOpen(false)
    setDismissCooldown()
  }, [])

  const dismiss = useCallback(() => {
    setIosGuideOpen(false)
    markDismissed()
  }, [markDismissed])

  return {
    installPlatform,
    installed,
    canShow,
    busy,
    iosGuideOpen,
    setIosGuideOpen,
    startInstall,
    closeIosGuide,
    dismiss,
    trackShown,
    canNativePrompt,
    canIosGuide,
  }
}
