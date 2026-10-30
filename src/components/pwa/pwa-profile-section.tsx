'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'
import { Bell, Download, Smartphone } from 'lucide-react'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { useInstallState } from '@/components/pwa/install-state-provider'
import { trackPwa } from '@/lib/pwa/analytics'
import { currentPushPermission, enablePush } from '@/lib/pwa/push'

const noopSubscribe = () => () => {}

function Row({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-neutral-900">{title}</p>
        <div className="mt-0.5 text-[13px] leading-[1.45] text-neutral-500">{children}</div>
      </div>
    </div>
  )
}

const linkButton =
  'mt-2 inline-flex items-center rounded-lg bg-primary px-3.5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60'

/** Пункты профиля: установка, «KudaClub на телефоне» (компьютер), уведомления. */
export function PwaProfileSection() {
  const { platform, installed, canNativePrompt } = useInstallState()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!platform) return null

  const isIos = platform === 'ios-safari' || platform === 'ios-other'
  const isInApp = platform === 'inapp-android' || platform === 'inapp-ios'
  const showInstall =
    !installed && (isIos || isInApp || platform === 'android')

  if (!showInstall && platform !== 'desktop' && !isIos && currentPushPermission() === 'unsupported') {
    return null
  }

  const openSheet = () => {
    trackPwa('pwa_prompt_shown', { trigger: 'profile_menu', platform })
    setSheetOpen(true)
  }

  return (
    <section className="mb-6 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {showInstall ? (
        <Row icon={<Download size={18} />} title="Установить приложение">
          Следующий код за 1 касание, без поиска в браузере.
          {platform === 'android' && !canNativePrompt ? (
            <p className="mt-1">Откройте меню браузера ⋮ и выберите «Установить приложение» или «Добавить на главный экран».</p>
          ) : (
            <div>
              <button type="button" className={linkButton} onClick={openSheet}>
                {isInApp ? 'Открыть в браузере' : 'Установить'}
              </button>
            </div>
          )}
        </Row>
      ) : null}

      {platform === 'desktop' ? <PhoneQrRow /> : null}

      <NotificationsRow platform={platform} />

      {sheetOpen ? (
        <InstallPrompt platform={platform} trigger="profile_menu" onClose={() => setSheetOpen(false)} />
      ) : null}
    </section>
  )
}

function PhoneQrRow() {
  const [qr, setQr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    QRCode.toDataURL(window.location.href, { margin: 1, width: 180, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Row icon={<Smartphone size={18} />} title="KudaClub на телефоне">
      Наведите камеру телефона на QR-код и сохраните KudaClub на экран «Домой».
      {open ? (
        qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR-код этой страницы" width={180} height={180} className="mt-3 rounded-lg border border-neutral-200" />
        ) : (
          <div className="mt-3 h-[180px] w-[180px] rounded-lg bg-neutral-100" />
        )
      ) : (
        <div>
          <button type="button" className={linkButton} onClick={() => setOpen(true)}>
            Показать QR-код
          </button>
        </div>
      )}
    </Row>
  )
}

function deniedInstructions(platform: string): string {
  if (platform === 'standalone' && /iPhone|iPad/.test(navigator.userAgent)) {
    return 'Откройте «Настройки» → «Уведомления» → KudaClub и включите «Допуск уведомлений».'
  }
  if (/Android/i.test(navigator.userAgent)) {
    return 'Нажмите на значок слева от адреса сайта (или долгое нажатие на иконку KudaClub → «О приложении») → «Уведомления» → разрешить.'
  }
  return 'Нажмите на значок замка слева от адреса сайта → «Уведомления» → «Разрешить».'
}

function NotificationsRow({ platform }: { platform: string }) {
  const systemPermission = useSyncExternalStore(noopSubscribe, currentPushPermission, () => 'unsupported' as const)
  const [override, setOverride] = useState<NotificationPermission | null>(null)
  const [pending, setPending] = useState(false)
  const permission = override ?? systemPermission

  if (permission === 'unsupported') {
    if (platform === 'ios-safari' || platform === 'ios-other') {
      return (
        <Row icon={<Bell size={18} />} title="Уведомления">
          На iPhone уведомления о новых 1+1 работают в установленном приложении KudaClub.
        </Row>
      )
    }
    return null
  }

  const enable = async () => {
    trackPwa('push_softask_accepted', { trigger: 'profile_menu' })
    setPending(true)
    const result = await enablePush()
    setPending(false)
    if (result === 'granted') {
      trackPwa('push_permission_granted', { trigger: 'profile_menu' })
      setOverride('granted')
    } else if (result === 'denied') {
      trackPwa('push_permission_denied', { trigger: 'profile_menu' })
      setOverride('denied')
    }
  }

  return (
    <Row icon={<Bell size={18} />} title="Уведомления">
      {permission === 'granted' ? (
        'Включены: новые 1+1 рядом с вами, не чаще 2 раз в неделю.'
      ) : permission === 'denied' ? (
        <>Уведомления запрещены в настройках. {deniedInstructions(platform)}</>
      ) : (
        <>
          Сообщим о новых 1+1 рядом с вами, не чаще 2 раз в неделю.
          <div>
            <button type="button" className={linkButton} onClick={enable} disabled={pending}>
              Включить уведомления
            </button>
          </div>
        </>
      )}
    </Row>
  )
}
