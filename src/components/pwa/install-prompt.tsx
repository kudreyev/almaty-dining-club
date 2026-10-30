'use client'

import { useCallback, useState } from 'react'
import {
  BottomSheet,
  SheetActions,
  SheetPrimaryButton,
  SheetSecondaryButton,
} from '@/components/pwa/bottom-sheet'
import { DownArrow, HomeScreenIcon, IosShareIcon, MoreIcon } from '@/components/pwa/pwa-icons'
import { useInstallState } from '@/components/pwa/install-state-provider'
import { trackPwa } from '@/lib/pwa/analytics'
import {
  androidChromeIntentUrl,
  isIpad,
  type InstallPlatform,
  type InstallTrigger,
} from '@/lib/pwa/install'

const TITLE = 'Сохраните KudaClub на экран'
const SUBTITLE = 'Следующий код за 1 касание, без поиска в браузере'

type InstallPromptProps = {
  platform: InstallPlatform
  trigger: InstallTrigger
  onClose: () => void
}

/**
 * Предложение установки в нижней панели. Вариант зависит от платформы:
 * Android — системный диалог, iOS — инструкция, встроенные браузеры — «Открыть в браузере».
 */
export function InstallPrompt({ platform, trigger, onClose }: InstallPromptProps) {
  const { promptNative, recordDismissed } = useInstallState()

  const dismiss = useCallback(() => {
    trackPwa('pwa_prompt_dismissed', { trigger, platform })
    // Из меню профиля — открыли сами, паузу не ставим.
    if (trigger !== 'profile_menu') recordDismissed()
    onClose()
  }, [trigger, platform, recordDismissed, onClose])

  const accept = useCallback(() => {
    trackPwa('pwa_prompt_accepted', { trigger, platform })
    onClose()
  }, [trigger, platform, onClose])

  if (platform === 'android') {
    return <AndroidInstall onAccept={accept} onDismiss={dismiss} promptNative={promptNative} />
  }
  if (platform === 'ios-safari' || platform === 'ios-other') {
    return <IosInstructions platform={platform} onAccept={accept} onDismiss={dismiss} />
  }
  if (platform === 'inapp-android' || platform === 'inapp-ios') {
    return <InAppBrowser platform={platform} onDismiss={dismiss} />
  }
  return null
}

function AndroidInstall({
  onAccept,
  onDismiss,
  promptNative,
}: {
  onAccept: () => void
  onDismiss: () => void
  promptNative: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}) {
  const [pending, setPending] = useState(false)

  const install = async () => {
    setPending(true)
    const outcome = await promptNative()
    setPending(false)
    if (outcome === 'accepted') onAccept()
    else onDismiss()
  }

  return (
    <BottomSheet title={TITLE} onClose={onDismiss}>
      <p className="mt-1 text-[14px] leading-[1.45] text-neutral-600">{SUBTITLE}</p>
      <SheetActions>
        <SheetSecondaryButton onClick={onDismiss}>Не сейчас</SheetSecondaryButton>
        <SheetPrimaryButton onClick={install} disabled={pending}>
          Установить
        </SheetPrimaryButton>
      </SheetActions>
    </BottomSheet>
  )
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[#007AFF]">
        {icon}
      </span>
      <p className="text-[14px] leading-[1.4] text-neutral-800">
        <span className="font-semibold">{n}.</span> {children}
      </p>
    </li>
  )
}

function IosInstructions({
  platform,
  onAccept,
  onDismiss,
}: {
  platform: 'ios-safari' | 'ios-other'
  onAccept: () => void
  onDismiss: () => void
}) {
  const ipad = typeof navigator !== 'undefined' && isIpad(navigator.userAgent, navigator.maxTouchPoints)
  // На iPhone в Safari кнопка «Поделиться» — на нижней панели (iOS 26: за кнопкой «⋯»).
  const pointDown = platform === 'ios-safari' && !ipad

  const where =
    platform === 'ios-other'
      ? 'в адресной строке браузера (или в его меню «⋯»)'
      : ipad
        ? 'вверху справа в Safari'
        : 'на панели Safari внизу экрана'

  return (
    <BottomSheet
      title={TITLE}
      onClose={onDismiss}
      footer={
        pointDown ? (
          <div className="mt-2 flex justify-center text-[#007AFF]" aria-hidden="true">
            <DownArrow className="h-8 w-5 animate-bounce" />
          </div>
        ) : null
      }
    >
      <p className="mt-1 text-[14px] leading-[1.45] text-neutral-600">{SUBTITLE}</p>
      <ol className="mt-4 space-y-3">
        <Step n={1} icon={<IosShareIcon className="h-5 w-5" />}>
          Нажмите «Поделиться» {where}
          {pointDown ? (
            <span className="text-neutral-500">
              {' '}
              — если панели нет, сначала нажмите <MoreIcon className="inline h-4 w-4 align-[-3px]" />
            </span>
          ) : null}
        </Step>
        <Step n={2} icon={<HomeScreenIcon className="h-5 w-5" />}>
          Выберите «На экран „Домой“» и нажмите «Добавить»
        </Step>
      </ol>
      <SheetActions>
        <SheetSecondaryButton onClick={onDismiss}>Не сейчас</SheetSecondaryButton>
        <SheetPrimaryButton onClick={onAccept}>Понятно</SheetPrimaryButton>
      </SheetActions>
    </BottomSheet>
  )
}

function InAppBrowser({
  platform,
  onDismiss,
}: {
  platform: 'inapp-android' | 'inapp-ios'
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  const href = typeof window !== 'undefined' ? window.location.href : ''

  const onOpenExternal = () => {
    trackPwa('inapp_browser_open_external_clicked', { platform })
  }

  const copy = async () => {
    onOpenExternal()
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <BottomSheet title="Откройте KudaClub в браузере" onClose={onDismiss}>
      <p className="mt-1 text-[14px] leading-[1.45] text-neutral-600">
        Во встроенном браузере приложения KudaClub нельзя сохранить на экран, а вход может
        слететь. В браузере следующий код — за 1 касание.
      </p>
      {platform === 'inapp-ios' ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2.5 text-[14px] text-neutral-800">
          <MoreIcon className="h-5 w-5 shrink-0 text-neutral-600" />
          Нажмите ⋯ в углу экрана → «Открыть в Safari»
        </p>
      ) : null}
      <SheetActions>
        <SheetSecondaryButton onClick={onDismiss}>Не сейчас</SheetSecondaryButton>
        {platform === 'inapp-android' ? (
          <a
            href={href ? androidChromeIntentUrl(href) : '#'}
            onClick={onOpenExternal}
            className="flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Открыть в браузере
          </a>
        ) : (
          <SheetPrimaryButton onClick={copy}>
            {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
          </SheetPrimaryButton>
        )}
      </SheetActions>
    </BottomSheet>
  )
}
