'use client'

import { useEffect } from 'react'

type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean }
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinelLike> }

/** Не даёт экрану погаснуть, пока active (Screen Wake Lock API; сбрасывается при сворачивании — берём снова). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
    if (!active || !api) return
    let sentinel: WakeLockSentinelLike | null = null
    let disposed = false

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      try {
        const next = await api.request('screen')
        if (disposed) void next.release().catch(() => {})
        else sentinel = next
      } catch {
        // нет разрешения / режим энергосбережения
      }
    }

    const onVisibility = () => void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
