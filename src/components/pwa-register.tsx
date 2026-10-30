'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Регистрирует service worker. Новая версия не активируется сама: показываем
 * «Доступна новая версия · Обновить», по нажатию — SKIP_WAITING и перезагрузка.
 * На экране активного кода панель не показываем, чтобы не сбить гостя у кассы.
 */
export function PwaRegister() {
  const pathname = usePathname() ?? '/'
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const reloadRequestedRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let registration: ServiceWorkerRegistration | null = null

    const trackInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        // Есть активный контроллер → это обновление, а не первая установка.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setWaiting(worker)
        }
      })
    }

    const onControllerChange = () => {
      if (reloadRequestedRef.current) window.location.reload()
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {})
    }

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          registration = reg
          if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
          trackInstalling(reg.installing)
          reg.addEventListener('updatefound', () => trackInstalling(reg.installing))
        })
        .catch(() => {
          // HTTP, приватный режим и т.п.
        })
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    document.addEventListener('visibilitychange', onVisible)
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('load', register)
    }
  }, [])

  if (!waiting || pathname.startsWith('/app/redeem')) return null

  const update = () => {
    reloadRequestedRef.current = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[105] flex justify-center px-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div
        role="status"
        className="flex items-center gap-3 rounded-full bg-neutral-900 py-2 pl-4 pr-2 text-[14px] text-white shadow-lg"
      >
        <span>Доступна новая версия</span>
        <button
          type="button"
          onClick={update}
          className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
        >
          Обновить
        </button>
      </div>
    </div>
  )
}
