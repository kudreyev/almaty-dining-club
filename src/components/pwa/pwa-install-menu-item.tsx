'use client'

/**
 * Постоянный пункт «Установить приложение» в кабинете.
 * Скрыт в standalone / после установки. Без кулдауна и без визитов.
 */

import { useEffect, useRef } from 'react'
import { usePwaInstallCta } from '@/hooks/use-pwa-install-cta'
import { PwaIosGuideSheet } from '@/components/pwa/pwa-ios-guide-sheet'

export function PwaInstallMenuItem() {
  const {
    installPlatform,
    installed,
    busy,
    iosGuideOpen,
    startInstall,
    closeIosGuide,
    trackShown,
  } = usePwaInstallCta({ placement: 'cabinet_menu', ignoreCooldown: true })

  const shownRef = useRef(false)

  // Показываем на iOS/Android, если ещё не установлено (даже без bip — кнопка попробует).
  const visible = Boolean(installPlatform) && !installed

  useEffect(() => {
    if (!visible || !installPlatform || shownRef.current) return
    // Не считаем «shown» при каждом рендере меню как промпт-баннер —
    // трекаем только при клике? Спека: pwa_prompt_shown с placement.
    // Для меню трекаем при первом показе пункта.
    shownRef.current = true
    trackShown()
  }, [visible, installPlatform, trackShown])

  if (!visible) return null

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => void startInstall()}
        className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-neutral-300 disabled:opacity-60"
      >
        <span className="text-[15px] font-medium text-neutral-900">
          Установить приложение
        </span>
        <span className="text-[13px] text-primary">
          {busy ? '…' : 'Добавить'}
        </span>
      </button>

      <PwaIosGuideSheet open={iosGuideOpen} onClose={closeIosGuide} />
    </>
  )
}
