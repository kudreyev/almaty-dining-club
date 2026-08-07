'use client'

/**
 * Баннер установки PWA в кабинете (со 2-го визита, кулдаун 7 дней).
 * Механика — usePwaInstallCta (общая с онбордингом и меню).
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { usePwaInstallCta } from '@/hooks/use-pwa-install-cta'
import { PwaIosGuideSheet } from '@/components/pwa/pwa-ios-guide-sheet'

type PwaInstallBannerProps = {
  meVisitCount?: number
  className?: string
}

export function PwaInstallBanner({
  meVisitCount = 0,
  className = '',
}: PwaInstallBannerProps) {
  const {
    installPlatform,
    canShow,
    busy,
    iosGuideOpen,
    startInstall,
    closeIosGuide,
    dismiss,
    trackShown,
  } = usePwaInstallCta({ placement: 'cabinet' })

  const shownRef = useRef(false)
  const visible = canShow && meVisitCount >= 2

  useEffect(() => {
    if (!visible || !installPlatform || shownRef.current) return
    shownRef.current = true
    trackShown()
  }, [visible, installPlatform, trackShown])

  if (!visible || !installPlatform) return null

  return (
    <>
      <div
        className={`relative rounded-xl border border-primary-light bg-primary-light/40 px-4 py-3.5 ${className}`}
        data-pwa-install-banner="cabinet"
      >
        <button
          type="button"
          onClick={dismiss}
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
          onClick={() => void startInstall()}
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Открываем…' : 'Добавить'}
        </button>
      </div>

      <PwaIosGuideSheet open={iosGuideOpen} onClose={closeIosGuide} />
    </>
  )
}
