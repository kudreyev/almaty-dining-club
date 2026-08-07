'use client'

/**
 * Баннер установки PWA.
 * Монтировать ТОЛЬКО у залогиненных подписчиков:
 * - экран успеха после оплаты
 * - /app/me со 2-го визита
 * Не ставить на лендинг и шаг чекаута.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { trackGoal } from '@/lib/analytics-client'
import {
  shouldOfferPwaInstall,
  setDismissCooldown,
  type PwaPlatform,
} from '@/lib/pwa/install'
import { usePwaInstall } from '@/components/pwa/pwa-install-provider'
import { PwaIosGuideSheet } from '@/components/pwa/pwa-ios-guide-sheet'

export type PwaInstallBannerPlacement = 'payment_success' | 'cabinet'

type PwaInstallBannerProps = {
  placement: PwaInstallBannerPlacement
  /**
   * Для кабинета: показывать только если визитов ≥ 2.
   * Для payment_success не используется (всегда при eligibility).
   */
  meVisitCount?: number
  className?: string
}

export function PwaInstallBanner({
  placement,
  meVisitCount = 0,
  className = '',
}: PwaInstallBannerProps) {
  const {
    platform,
    installed,
    canNativePrompt,
    canIosGuide,
    promptNativeInstall,
    markDismissed,
    markAccepted,
  } = usePwaInstall()

  const [visible, setVisible] = useState(false)
  const [iosGuideOpen, setIosGuideOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shownTracked, setShownTracked] = useState(false)

  const installPlatform: PwaPlatform | null =
    platform === 'ios' || platform === 'android' ? platform : null

  const eligibleBase =
    Boolean(installPlatform) &&
    shouldOfferPwaInstall({ installed }) &&
    (platform === 'ios' ? canIosGuide : canNativePrompt)

  const eligible =
    eligibleBase &&
    (placement === 'payment_success' || meVisitCount >= 2)

  useEffect(() => {
    setVisible(eligible)
  }, [eligible])

  useEffect(() => {
    if (!visible || shownTracked || !installPlatform) return
    setShownTracked(true)
    trackGoal('pwa_prompt_shown', { platform: installPlatform })
  }, [visible, shownTracked, installPlatform])

  if (!visible || !installPlatform) return null

  const onDismiss = () => {
    setVisible(false)
    setIosGuideOpen(false)
    markDismissed()
  }

  const onAddClick = async () => {
    if (installPlatform === 'ios') {
      markAccepted()
      setIosGuideOpen(true)
      return
    }

    setBusy(true)
    try {
      const outcome = await promptNativeInstall()
      if (outcome === 'accepted' || outcome === 'dismissed') {
        setVisible(false)
      }
    } finally {
      setBusy(false)
    }
  }

  const onIosGuideClose = () => {
    setIosGuideOpen(false)
    setVisible(false)
    // Кулдаун 14 дней без повторного dismissed — accepted уже ушёл при открытии шторки.
    setDismissCooldown()
  }

  return (
    <>
      <div
        className={`relative rounded-xl border border-primary-light bg-primary-light/40 px-4 py-3.5 ${className}`}
        data-pwa-install-banner={placement}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрыть"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/70 hover:text-neutral-700"
        >
          <X size={14} strokeWidth={1.8} />
        </button>

        <p className="pr-7 text-[14px] font-medium leading-[1.4] text-neutral-900">
          Добавьте kudaclub на экран — код скидки всегда под рукой
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAddClick()}
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Открываем…' : 'Добавить'}
        </button>
      </div>

      <PwaIosGuideSheet open={iosGuideOpen} onClose={onIosGuideClose} />
    </>
  )
}
