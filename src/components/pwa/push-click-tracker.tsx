'use client'

/**
 * Надёжный учёт push_clicked:
 * 1) query ?push_click=1 при openWindow из SW (холодный старт)
 * 2) postMessage от SW при focus существующего окна
 *
 * campaign_id: из ?push_campaign= / postMessage → Метрика + click_count.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { trackGoal } from '@/lib/analytics-client'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeCampaignId(raw: string | null | undefined): string | null {
  if (!raw || !UUID_RE.test(raw)) return null
  return raw
}

function reportPushClick(campaignId: string | null) {
  const params = campaignId ? { campaign_id: campaignId } : undefined
  trackGoal('push_clicked', params)

  if (!campaignId) return
  fetch('/api/push/click', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campaignId }),
    keepalive: true,
  }).catch(() => {
    // best-effort
  })
}

function stripPushParams(url: URL): string {
  url.searchParams.delete('push_click')
  url.searchParams.delete('push_campaign')
  return (
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
    url.hash
  )
}

export function PushClickTracker() {
  const pathname = usePathname()
  const router = useRouter()
  const handledKeyRef = useRef<string | null>(null)

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('push_click') !== '1') return

      const campaignId = normalizeCampaignId(
        url.searchParams.get('push_campaign'),
      )
      const key = `q:${url.pathname}:${campaignId ?? ''}:${url.search}`
      if (handledKeyRef.current === key) return
      handledKeyRef.current = key

      reportPushClick(campaignId)
      window.history.replaceState({}, '', stripPushParams(url))
    } catch {
      // ignore
    }
  }, [pathname])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; url?: string; campaign_id?: string }
        | null
        | undefined
      if (!data || data.type !== 'PUSH_CLICK') return

      let campaignId = normalizeCampaignId(data.campaign_id)
      let target: URL | null = null

      if (typeof data.url === 'string' && data.url) {
        try {
          target = new URL(data.url, window.location.origin)
          if (!campaignId) {
            campaignId = normalizeCampaignId(
              target.searchParams.get('push_campaign'),
            )
          }
        } catch {
          target = null
        }
      }

      const key = `m:${campaignId ?? ''}:${target?.href ?? ''}`
      if (handledKeyRef.current === key) return
      handledKeyRef.current = key

      reportPushClick(campaignId)

      if (target) {
        const path = stripPushParams(target)
        const current =
          window.location.pathname +
          window.location.search +
          window.location.hash
        if (path !== current) {
          router.push(path)
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [router])

  return null
}
