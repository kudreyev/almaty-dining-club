'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  completeEmbeddedSignup,
  type CompleteEmbeddedSignupResult,
} from './actions'

const GRAPH_API_VERSION = 'v21.0'

type SessionPayload = {
  type?: string
  event?: string
  data?: {
    waba_id?: string
    phone_number_id?: string
    business_id?: string
  }
}

type FBLoginResponse = {
  authResponse?: { code?: string }
  status?: string
}

type Props = {
  appId: string
  configId: string
}

export function EmbeddedSignupLauncher({ appId, configId }: Props) {
  const [sdkReady, setSdkReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompleteEmbeddedSignupResult | null>(null)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const sessionRef = useRef<SessionPayload | null>(null)
  const pendingCodeRef = useRef<string | null>(null)

  const tryCompleteIfReady = useCallback(async () => {
    const code = pendingCodeRef.current
    const session = sessionRef.current
    const wabaId = session?.data?.waba_id
    const phoneNumberId = session?.data?.phone_number_id
    const event = session?.event

    if (!code || !wabaId || !phoneNumberId || !event) return

    setBusy(true)
    setError(null)

    try {
      const completed = await completeEmbeddedSignup({
        code,
        wabaId,
        phoneNumberId,
        businessId: session.data?.business_id,
        event,
      })
      setResult(completed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка onboarding')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: GRAPH_API_VERSION,
      })
      setSdkReady(true)
    }
  }, [appId])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return

      let data: SessionPayload
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }

      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return

      sessionRef.current = data
      setLastEvent(data.event ?? null)
      void tryCompleteIfReady()
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [tryCompleteIfReady])

  const launch = () => {
    if (!sdkReady || !window.FB) {
      setError('Facebook SDK ещё не загрузился')
      return
    }

    setBusy(true)
    setError(null)
    setResult(null)
    sessionRef.current = null
    pendingCodeRef.current = null

    window.FB.login(
      (response: FBLoginResponse) => {
        const code = response.authResponse?.code
        if (!code) {
          setBusy(false)
          setError('Flow отменён или code не получен')
          return
        }

        pendingCodeRef.current = code
        void tryCompleteIfReady()
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        crossOrigin="anonymous"
      />

      <Card>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Подключите <strong>77066059899</strong> через coexistence: WhatsApp Business на телефоне
            останется, Cloud API получит webhook на kudaclub.kz.
          </p>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>WhatsApp Business на телефоне, версия 2.24.17+</li>
            <li>В popup выберите «Подключить существующий WhatsApp Business»</li>
            <li>Подтвердите Connect в приложении и завершите flow</li>
          </ol>

          <Button type="button" onClick={launch} disabled={!sdkReady || busy}>
            {busy ? 'Подключение…' : 'Подключить WhatsApp Business'}
          </Button>

          {!sdkReady ? (
            <p className="text-xs text-gray-400">Загрузка Facebook SDK…</p>
          ) : null}

          {lastEvent ? (
            <p className="text-xs text-gray-500">Событие Meta: {lastEvent}</p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Card>

      {result ? (
        <Card className="mt-4">
          <div className="space-y-3">
            <p className="font-semibold text-green-800">Onboarding завершён</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">WHATSAPP_PHONE_NUMBER_ID</dt>
                <dd className="font-mono text-xs break-all">{result.phoneNumberId}</dd>
              </div>
              <div>
                <dt className="text-gray-500">WABA ID</dt>
                <dd className="font-mono text-xs break-all">{result.wabaId}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Coexistence</dt>
                <dd>
                  is_on_biz_app={String(result.isOnBizApp)},{' '}
                  platform_type={result.platformType ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">WHATSAPP_CLOUD_ACCESS_TOKEN</dt>
                <dd className="font-mono text-xs break-all">{result.accessToken}</dd>
              </div>
            </dl>
            <p className="text-xs text-amber-800">
              Скопируйте значения в Vercel → Environment Variables → Redeploy. Токен живёт{' '}
              {result.expiresIn ? `${result.expiresIn} сек` : '~60 дней'} — позже замените на System
              User token.
            </p>
          </div>
        </Card>
      ) : null}
    </>
  )
}

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void
      login: (
        callback: (response: FBLoginResponse) => void,
        options: Record<string, unknown>,
      ) => void
    }
    fbAsyncInit?: () => void
  }
}
