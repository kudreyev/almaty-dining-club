'use client'

const YM_ID = process.env.NEXT_PUBLIC_YM_ID

declare global {
  interface Window {
    ym?: (id: string | number, action: string, ...args: unknown[]) => void
  }
}

function sendToLocalAnalytics(
  goalName: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return

  const page =
    typeof window.location?.pathname === 'string'
      ? window.location.pathname
      : undefined

  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: goalName, params, page }),
    keepalive: true,
  }).catch(() => {
    // Best-effort: аналитика не должна ломать UX.
  })
}

export function trackGoal(goalName: string, params?: Record<string, unknown>): void {
  sendToLocalAnalytics(goalName, params)

  if (typeof window === 'undefined' || !window.ym || !YM_ID) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Metrica] Goal (not sent in dev):', goalName, params)
    }
    return
  }

  try {
    window.ym(Number(YM_ID), 'reachGoal', goalName, params)
  } catch (error) {
    console.error('[Metrica] Failed to track goal:', error)
  }
}

export function setUserParams(params: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.ym || !YM_ID) return

  try {
    window.ym(Number(YM_ID), 'userParams', params)
  } catch (error) {
    console.error('[Metrica] Failed to set user params:', error)
  }
}

export function setUserId(userId: string): void {
  if (typeof window === 'undefined' || !window.ym || !YM_ID) return

  try {
    window.ym(Number(YM_ID), 'setUserID', userId)
  } catch (error) {
    console.error('[Metrica] Failed to set user id:', error)
  }
}
