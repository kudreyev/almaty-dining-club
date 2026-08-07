'use client'

/**
 * Карточка opt-in на web-push. Только /app/me у активных подписчиков.
 * Notification.requestPermission() — исключительно по клику «Да, хочу».
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { trackGoal } from '@/lib/analytics-client'
import { isStandaloneDisplay } from '@/lib/pwa/install'
import {
  detectPushPlatform,
  isPushApiSupported,
  isPushDismissCooldownActive,
  setPushDismissCooldown,
  urlBase64ToUint8Array,
} from '@/lib/pwa/push'

type Status = 'loading' | 'hidden' | 'ready' | 'busy' | 'done'

export function PwaPushOptIn() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false

    async function evaluate() {
      if (!isPushApiSupported()) {
        if (!cancelled) setStatus('hidden')
        return
      }

      const platform = detectPushPlatform()
      // iOS: пуши только из установленного PWA (standalone).
      if (platform === 'ios' && !isStandaloneDisplay()) {
        if (!cancelled) setStatus('hidden')
        return
      }

      if (isPushDismissCooldownActive()) {
        if (!cancelled) setStatus('hidden')
        return
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('hidden')
        return
      }

      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (Notification.permission === 'granted' && existing) {
          if (!cancelled) setStatus('hidden')
          return
        }
      } catch {
        // SW ещё не готов — карточку можно показать.
      }

      if (!cancelled) setStatus('ready')
    }

    void evaluate()
    return () => {
      cancelled = true
    }
  }, [])

  const onDismiss = () => {
    setPushDismissCooldown()
    setStatus('hidden')
  }

  const onEnable = async () => {
    setStatus('busy')
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY?.trim()
      if (!publicKey) {
        setStatus('ready')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        trackGoal('push_permission_denied')
        setPushDismissCooldown()
        setStatus('hidden')
        return
      }
      if (permission !== 'granted') {
        // default / закрыл системный диалог без выбора
        setPushDismissCooldown()
        setStatus('hidden')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      const json = subscription.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          platform: detectPushPlatform(),
        }),
      })

      if (!res.ok) {
        setStatus('ready')
        return
      }

      trackGoal('push_permission_granted')
      setStatus('done')
      window.setTimeout(() => setStatus('hidden'), 1800)
    } catch {
      setStatus('ready')
    }
  }

  if (status === 'loading' || status === 'hidden') return null

  if (status === 'done') {
    return (
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-[14px] text-emerald-800">
        Готово — будем присылать подборку по пятницам.
      </div>
    )
  }

  return (
    <div
      className="relative mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      data-pwa-push-opt-in
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X size={14} strokeWidth={1.8} />
      </button>

      <p className="pr-7 text-[14px] font-medium leading-[1.4] text-neutral-900">
        Присылать подборку «куда сходить» по пятницам?
      </p>
      <button
        type="button"
        disabled={status === 'busy'}
        onClick={() => void onEnable()}
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'busy' ? 'Подключаем…' : 'Да, хочу'}
      </button>
    </div>
  )
}
