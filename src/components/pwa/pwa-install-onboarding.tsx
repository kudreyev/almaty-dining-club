'use client'

/**
 * Полноэкранный шаг установки после оплаты (только автологин / success).
 * Если уже standalone/установлено или платформа неподдерживаемая — onSkip (кабинет).
 */

import { useEffect, useRef, useState } from 'react'
import { trackGoal } from '@/lib/analytics-client'
import { usePwaInstall } from '@/components/pwa/pwa-install-provider'
import { usePwaInstallCta } from '@/hooks/use-pwa-install-cta'
import { PwaIosGuideSheet } from '@/components/pwa/pwa-ios-guide-sheet'
import { setDismissCooldown } from '@/lib/pwa/install'

type Props = {
  onSkip: () => void
}

export function PwaInstallOnboarding({ onSkip }: Props) {
  const { installed } = usePwaInstall()
  const {
    installPlatform,
    busy,
    iosGuideOpen,
    startInstall,
    closeIosGuide,
    trackShown,
  } = usePwaInstallCta({ placement: 'onboarding', ignoreCooldown: true })

  const [visible, setVisible] = useState(false)
  const shownRef = useRef(false)
  const skippedRef = useRef(false)

  const skip = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    onSkip()
  }

  useEffect(() => {
    // Короткая пауза: успеть поймать beforeinstallprompt после оплаты.
    const timer = window.setTimeout(() => {
      if (installed || !installPlatform) {
        skip()
        return
      }
      setVisible(true)
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed, installPlatform])

  useEffect(() => {
    if (!visible || !installPlatform || shownRef.current) return
    shownRef.current = true
    trackShown()
  }, [visible, installPlatform, trackShown])

  const onLater = () => {
    trackGoal('pwa_onboarding_skipped')
    setDismissCooldown()
    skip()
  }

  const onAdd = async () => {
    const outcome = await startInstall()
    if (outcome === 'accepted') {
      skip()
    }
    // ios_guide — ждём закрытия шторки; dismissed — остаёмся на шаге
  }

  const onGuideClose = () => {
    closeIosGuide()
    skip()
  }

  if (!visible || !installPlatform) return null

  return (
    <>
      <div className="fixed inset-0 z-[110] flex flex-col bg-[#fafaf9] px-6 pb-10 pt-16">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center text-center">
          <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.4px] text-neutral-900">
            Добавьте kudaclub на экран
          </h1>
          <p className="mt-3 text-[15px] leading-[1.5] text-neutral-500">
            Код скидки всегда под рукой — не придётся искать сайт в браузере
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onAdd()}
            className="mt-10 flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3.5 text-[16px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Открываем…' : 'Добавить'}
          </button>

          <button
            type="button"
            onClick={onLater}
            className="mt-5 text-[14px] text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-600 hover:underline"
          >
            Позже
          </button>
        </div>
      </div>

      <PwaIosGuideSheet open={iosGuideOpen} onClose={onGuideClose} />
    </>
  )
}
