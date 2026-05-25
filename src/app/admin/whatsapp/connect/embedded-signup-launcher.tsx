'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  completeEmbeddedSignup,
  type CompleteEmbeddedSignupResult,
} from './actions'

const GRAPH_API_VERSION = 'v21.0'
const POPUP_TIMEOUT_MS = 120_000

type SessionPayload = {
  type?: string
  event?: string
  data?: {
    waba_id?: string
    phone_number_id?: string
    business_id?: string
  }
}

type Props = {
  appId: string
  configId: string
  redirectUri: string
  urlCode?: string
  urlError?: string
}

export function EmbeddedSignupLauncher({
  appId,
  configId,
  redirectUri,
  urlCode,
  urlError,
}: Props) {
  const [popupOpen, setPopupOpen] = useState(false)
  const [exchanging, setExchanging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompleteEmbeddedSignupResult | null>(null)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const sessionRef = useRef<SessionPayload | null>(null)
  const exchangingRef = useRef(false)
  const consumedCodeRef = useRef<string | null>(null)
  const popupPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const oauthExtras = {
    setup: {},
    featureType: 'whatsapp_business_app_onboarding',
    sessionInfoVersion: '3',
  } as const

  const clearPopupTimers = useCallback(() => {
    if (popupPollRef.current) {
      clearInterval(popupPollRef.current)
      popupPollRef.current = null
    }
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current)
      popupTimeoutRef.current = null
    }
  }, [])

  useEffect(() => () => clearPopupTimers(), [clearPopupTimers])

  const buildOAuthUrl = useCallback(() => {
    const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`)
    url.searchParams.set('client_id', appId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('override_default_response_type', 'true')
    url.searchParams.set('config_id', configId)
    url.searchParams.set('state', 'whatsapp_connect')
    url.searchParams.set('extras', JSON.stringify(oauthExtras))
    return url.toString()
  }, [appId, configId, redirectUri])

  const runComplete = useCallback(
    async (code: string) => {
      if (consumedCodeRef.current === code || exchangingRef.current) return

      const session = sessionRef.current
      exchangingRef.current = true
      consumedCodeRef.current = code
      setExchanging(true)
      setError(null)
      setStatus('Обмен code на token…')

      try {
        const response = await completeEmbeddedSignup({
          code,
          oauthRedirectUri: redirectUri,
          oauthExchangeMode: 'oauth_redirect',
          wabaId: session?.data?.waba_id,
          phoneNumberId: session?.data?.phone_number_id,
          businessId: session?.data?.business_id,
          event: session?.event,
        })

        if (!response.ok) {
          consumedCodeRef.current = null
          setError(`[${response.step}] ${response.error}`)
          setStatus(null)
          return
        }

        setResult(response.result)
        setStatus('Готово — скопируйте значения в Vercel.')
      } catch (err) {
        consumedCodeRef.current = null
        setError(err instanceof Error ? err.message : 'Ошибка onboarding')
        setStatus(null)
      } finally {
        exchangingRef.current = false
        setExchanging(false)
        setPopupOpen(false)
        clearPopupTimers()
      }
    },
    [redirectUri, clearPopupTimers],
  )

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) {
        const data = event.data as { type?: string; code?: string }
        if (data?.type === 'KUDACLUB_WA_OAUTH' && data.code) {
          void runComplete(data.code)
        }
        return
      }

      if (!event.origin.includes('facebook.com') && !event.origin.includes('meta.com')) return

      let data: SessionPayload
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }

      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return

      sessionRef.current = data
      setLastEvent(data.event ?? null)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [runComplete])

  useEffect(() => {
    if (urlError) setError(urlError)
    if (urlCode && !window.opener) {
      window.history.replaceState({}, '', '/admin/whatsapp/connect')
      void runComplete(urlCode)
    }
  }, [urlCode, urlError, runComplete])

  const resetFlow = () => {
    clearPopupTimers()
    setPopupOpen(false)
    setExchanging(false)
    setStatus(null)
    setError(null)
    exchangingRef.current = false
    sessionRef.current = null
    consumedCodeRef.current = null
  }

  const launchOAuthPopup = () => {
    resetFlow()
    setResult(null)
    setPopupOpen(true)
    setStatus('Popup Meta — завершите подключение…')

    const popup = window.open(
      buildOAuthUrl(),
      'meta_whatsapp_oauth',
      'width=520,height=720,scrollbars=yes,resizable=yes',
    )

    if (!popup) {
      setPopupOpen(false)
      setError('Popup заблокирован. Разрешите popup для kudaclub.kz или используйте full-page OAuth.')
      setStatus(null)
      return
    }

    popupPollRef.current = setInterval(() => {
      if (popup.closed) {
        clearPopupTimers()
        setPopupOpen(false)
        if (!consumedCodeRef.current && !exchangingRef.current) {
          setError('Popup закрыт без code. Нажмите «Сбросить» и попробуйте снова.')
          setStatus(null)
        }
      }
    }, 500)

    popupTimeoutRef.current = setTimeout(() => {
      if (!consumedCodeRef.current && !exchangingRef.current) {
        setPopupOpen(false)
        setError('Meta не вернула code за 2 минуты. «Сбросить» → повтор.')
        setStatus(null)
      }
    }, POPUP_TIMEOUT_MS)
  }

  const launchFullPageOAuth = () => {
    resetFlow()
    setResult(null)
    window.location.assign(buildOAuthUrl())
  }

  const buttonLabel = exchanging
    ? 'Сохранение…'
    : popupOpen
      ? 'Ожидание Meta…'
      : 'Подключить WhatsApp Business'

  return (
    <>
      <Card>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Подключите <strong>77066059899</strong> через coexistence: WhatsApp Business на телефоне
            останется, Cloud API получит webhook на kudaclub.kz.
          </p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Обязательно:</strong> экран «Подключить существующий WhatsApp Business» →{' '}
            <strong>+7 706 605 9899</strong> → Confirm на телефоне. Если номер не спрашивают — в Meta
            нужна другая Configuration (coexistence), не sandbox <code>+1 555…</code>.
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            Chrome, admin на kudaclub.kz. OAuth redirect: <code>{redirectUri}</code>. После ошибки —{' '}
            <strong>«Сбросить»</strong> и новый проход (code ~30 сек).
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>WhatsApp Business на телефоне, версия 2.24.17+</li>
            <li>В Meta popup — «Подключить существующий WhatsApp Business»</li>
            <li>Confirm в приложении → дождитесь «Готово» на этой странице</li>
          </ol>

          <p className="text-xs text-gray-500">
            App ID: {appId} · Config ID: {configId.slice(0, 6)}…
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={launchOAuthPopup} disabled={popupOpen || exchanging}>
              {buttonLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={launchFullPageOAuth}
              disabled={popupOpen || exchanging}
            >
              Full-page OAuth
            </Button>
            {error || popupOpen || status ? (
              <Button type="button" variant="ghost" onClick={resetFlow}>
                Сбросить
              </Button>
            ) : null}
          </div>

          {status ? <p className="text-xs text-gray-600">{status}</p> : null}

          {lastEvent ? (
            <p className="text-xs text-gray-500">Событие Meta: {lastEvent}</p>
          ) : null}

          {lastEvent && lastEvent !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ? (
            <p className="text-xs text-amber-800">
              Coexistence не завершён — нужно событие FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING.
            </p>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p>{error}</p>
              <p className="mt-2 text-xs">
                [exchange] → проверьте <code>WHATSAPP_APP_SECRET</code> и redirect URI в Meta. [discover]{' '}
                +1 555… → создайте новую Embedded Signup Configuration с coexistence (Config{' '}
                {configId.slice(0, 6)}…).
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      {result ? (
        <Card className="mt-4">
          <div className="space-y-3">
            <p className="font-semibold text-green-800">Onboarding завершён</p>
            {result.assetSource === 'graph_api' ? (
              <p className="text-xs text-blue-800">
                WABA/phone найдены через Graph API (session logging Meta не пришёл).
              </p>
            ) : null}
            {!result.isOnBizApp ? (
              <p className="text-xs text-amber-800">
                is_on_biz_app=false — пройдите connect с экраном «Подключить существующий WhatsApp
                Business».
              </p>
            ) : null}
            {result.coexistenceWarning ? (
              <p className="text-xs text-amber-800">Coexistence check: {result.coexistenceWarning}</p>
            ) : null}
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
              Скопируйте значения в Vercel → Environment Variables → Redeploy.
            </p>
          </div>
        </Card>
      ) : null}
    </>
  )
}
