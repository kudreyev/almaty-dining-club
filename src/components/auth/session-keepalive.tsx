'use client'

/**
 * Держит Supabase-сессию живой в установленном PWA:
 * auto-refresh при фокусе / возврате во вкладку + периодический refresh.
 * Без этого после долгого простоя access JWT протухает и юзер видит /login.
 */

import { useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000
/** Обновляем, если до expiry меньше 5 минут. */
const REFRESH_AHEAD_MS = 5 * 60 * 1000

export function SessionKeepAlive() {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    const refreshIfNeeded = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) return

        const expiresAtMs = (data.session.expires_at ?? 0) * 1000
        if (expiresAtMs - Date.now() < REFRESH_AHEAD_MS) {
          await supabase.auth.refreshSession()
        }
      } catch {
        // сеть / private mode — не роняем UI
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshIfNeeded()
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // подписка активирует внутренний autoRefreshToken таймер клиента
    })

    void refreshIfNeeded()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const intervalId = window.setInterval(() => {
      void refreshIfNeeded()
    }, REFRESH_INTERVAL_MS)

    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(intervalId)
    }
  }, [])

  return null
}
