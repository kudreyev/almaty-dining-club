'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { useInstallState } from '@/components/pwa/install-state-provider'
import { PushSoftAsk, type PushSoftAskTrigger } from '@/components/pwa/push-soft-ask'
import { trackPwa } from '@/lib/pwa/analytics'
import {
  PWA_STORAGE,
  canShowPushSoftAsk,
  isRepeatVisitWithin7Days,
  readStored,
  readVisits,
  registerVisit,
  writeStored,
  writeVisits,
  type InstallTrigger,
} from '@/lib/pwa/install'
import { currentPushPermission, isPushApiSupported, syncPushSubscription } from '@/lib/pwa/push'
import { VALUE_MOMENT_EVENT, type ValueMomentKind } from '@/lib/pwa/value-moment'

type Sheet =
  | { kind: 'install'; trigger: InstallTrigger }
  | { kind: 'push'; trigger: PushSoftAskTrigger }

const CODE_DELAY_MS = 2000
const SECOND_VISIT_DELAY_MS = 20_000
const FIRST_LAUNCH_DELAY_MS = 3000

const CATALOG_PATHS = new Set(['/almaty', '/astana'])
const QUIET_PREFIXES = ['/login', '/auth', '/staff', '/admin', '/partner', '/onboarding']

function isQuietPath(pathname: string) {
  return QUIET_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Решает, когда показать предложение установки или мягкий экран push.
 * Никогда на первом экране: только после кода, на повторном визите или при запуске установленного приложения.
 * За сессию — не больше одной панели.
 */
export function PromptHost() {
  const pathname = usePathname() ?? '/'
  const install = useInstallState()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const sheetRef = useRef<Sheet | null>(null)
  const installRef = useRef(install)
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    installRef.current = install
    pathnameRef.current = pathname
  })

  const open = useCallback((next: Sheet) => {
    if (sheetRef.current) return false
    if (readStored(PWA_STORAGE.sheetShown, 'session') === '1') return false
    if (isQuietPath(pathnameRef.current)) return false
    writeStored(PWA_STORAGE.sheetShown, '1', 'session')
    sheetRef.current = next
    setSheet(next)
    const platform = installRef.current.platform
    if (next.kind === 'install') {
      installRef.current.recordShown()
      trackPwa('pwa_prompt_shown', { trigger: next.trigger, platform })
    } else {
      trackPwa('push_softask_shown', { trigger: next.trigger, platform })
    }
    return true
  }, [])

  const close = useCallback(() => {
    sheetRef.current = null
    setSheet(null)
  }, [])

  const canInstall = useCallback((trigger: InstallTrigger) => {
    const state = installRef.current
    if (!state.platform || state.installed || !state.canAutoShow()) return false
    switch (state.platform) {
      case 'android':
        return state.canNativePrompt
      case 'ios-safari':
      case 'ios-other':
        return true
      case 'inapp-android':
      case 'inapp-ios':
        // Во встроенных браузерах — только после кода: там «Открыть в браузере».
        return trigger === 'code_redeemed' || trigger === 'after_code'
      default:
        return false
    }
  }, [])

  const canPush = useCallback(() => {
    const platform = installRef.current.platform
    if (!platform) return false
    const dismissedRaw = Number(readStored(PWA_STORAGE.pushSoftAsk))
    return canShowPushSoftAsk({
      supported: isPushApiSupported(),
      permission: currentPushPermission(),
      platform,
      dismissedAt: Number.isFinite(dismissedRaw) && dismissedRaw > 0 ? dismissedRaw : null,
      redeemedOnce: readStored(PWA_STORAGE.redeemedOnce) === '1',
      now: Date.now(),
    })
  }, [])

  const offerAfterCode = useCallback(
    (trigger: 'code_redeemed' | 'after_code') => {
      if (canInstall(trigger) && open({ kind: 'install', trigger })) return
      // Android без установки (или после неё): push после первого погашенного кода.
      if (trigger === 'code_redeemed' && canPush()) {
        open({ kind: 'push', trigger: 'code_redeemed' })
      }
    },
    [canInstall, canPush, open],
  )

  // Код показан / погашен.
  useEffect(() => {
    const timers: number[] = []
    const onMoment = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: ValueMomentKind }>).detail?.kind
      if (kind === 'code_shown') {
        writeStored(PWA_STORAGE.afterCode, '1', 'session')
      } else if (kind === 'code_redeemed') {
        writeStored(PWA_STORAGE.redeemedOnce, '1')
        writeStored(PWA_STORAGE.afterCode, null, 'session')
        timers.push(window.setTimeout(() => offerAfterCode('code_redeemed'), CODE_DELAY_MS))
      }
    }
    window.addEventListener(VALUE_MOMENT_EVENT, onMoment)
    return () => {
      window.removeEventListener(VALUE_MOMENT_EVENT, onMoment)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [offerAfterCode])

  // Код не погашен — предлагаем после ухода с экрана кода.
  useEffect(() => {
    if (pathname.startsWith('/app/redeem')) return
    if (readStored(PWA_STORAGE.afterCode, 'session') !== '1') return
    writeStored(PWA_STORAGE.afterCode, null, 'session')
    const timer = window.setTimeout(() => offerAfterCode('after_code'), CODE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pathname, offerAfterCode])

  // Учёт визитов (новый визит — после 30 минут бездействия).
  useEffect(() => {
    writeVisits(registerVisit(readVisits(), Date.now()))
  }, [pathname])

  // Второй визит за 7 дней, гость вошёл: в каталоге через 20 секунд или после половины прокрутки.
  const { loggedIn, platform } = install
  useEffect(() => {
    if (!CATALOG_PATHS.has(pathname) || loggedIn !== true) return
    if (!isRepeatVisitWithin7Days(readVisits(), Date.now())) return
    if (!canInstall('second_visit')) return

    let done = false
    const fire = () => {
      if (done) return
      done = true
      cleanup()
      if (canInstall('second_visit')) open({ kind: 'install', trigger: 'second_visit' })
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max > 0 && window.scrollY / max >= 0.5) fire()
    }
    const timer = window.setTimeout(fire, SECOND_VISIT_DELAY_MS)
    window.addEventListener('scroll', onScroll, { passive: true })
    function cleanup() {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
    return cleanup
  }, [pathname, loggedIn, platform, canInstall, open])

  // Первый запуск установленного приложения: мягкий экран push.
  useEffect(() => {
    if (platform !== 'standalone') return
    if (readStored(PWA_STORAGE.pushFirstLaunchAsked) === '1') return
    if (pathname.startsWith('/app/redeem') || isQuietPath(pathname)) return
    const timer = window.setTimeout(() => {
      writeStored(PWA_STORAGE.pushFirstLaunchAsked, '1')
      if (canPush()) open({ kind: 'push', trigger: 'first_launch' })
    }, FIRST_LAUNCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [platform, pathname, canPush, open])

  // Разрешение уже есть — освежаем подписку на сервере (город, вход в установленном приложении).
  useEffect(() => {
    if (loggedIn === true) void syncPushSubscription()
  }, [loggedIn])

  if (!sheet || !platform) return null
  if (sheet.kind === 'install') {
    return <InstallPrompt platform={platform} trigger={sheet.trigger} onClose={close} />
  }
  return <PushSoftAsk trigger={sheet.trigger} onClose={close} />
}
