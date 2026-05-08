'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import {
  extendRedeemToken,
  generateRedeemToken,
} from '@/app/app/redeem/[restaurantId]/[offerId]/actions'
import { getAppSiteOrigin } from '@/lib/site-url'
import { Button } from '@/components/ui/button'
import { trackGoal } from '@/lib/analytics-client'

type RedeemTokenCardProps = {
  tokenId: string
  tokenCode: string
  expiresAt: string
  extendDeadlineAt: string
  extendedOnce: boolean
  restaurantId: string
  offerId: string
  metricaOffer?: {
    restaurantSlug: string
    offerType: '2for1' | 'compliment'
    estimatedSavingsTenge: number | null
  }
}

function getRemainingMs(expiresAt: string) {
  return new Date(expiresAt).getTime() - Date.now()
}

function formatTime(ms: number) {
  if (ms <= 0) return '00:00'

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function RedeemTokenCard({
  tokenId,
  tokenCode,
  expiresAt,
  extendDeadlineAt,
  extendedOnce,
  restaurantId,
  offerId,
  metricaOffer,
}: RedeemTokenCardProps) {
  const router = useRouter()
  const [localExpires, setLocalExpires] = useState(expiresAt)
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(expiresAt))
  const [showCode, setShowCode] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const extendRefreshDone = useRef(false)

  const staffUrl = useMemo(() => {
    const origin = getAppSiteOrigin()
    return `${origin}/staff/redeem?token=${encodeURIComponent(tokenCode)}`
  }, [tokenCode])

  useEffect(() => {
    setLocalExpires(expiresAt)
  }, [expiresAt])

  useEffect(() => {
    setRemainingMs(getRemainingMs(localExpires))
  }, [localExpires])

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(getRemainingMs(localExpires))
    }, 1000)

    return () => clearInterval(interval)
  }, [localExpires])

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(staffUrl, { margin: 1, width: 200, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [staffUrl])

  const [extendState, extendFormAction, extendPending] = useActionState(
    extendRedeemToken,
    null
  )

  useEffect(() => {
    if (extendState?.ok && extendState.expiresAt) {
      setLocalExpires(extendState.expiresAt)
    }
  }, [extendState])

  useEffect(() => {
    if (extendState?.ok && !extendRefreshDone.current) {
      extendRefreshDone.current = true
      router.refresh()
    }
  }, [extendState?.ok, router])

  const isExpired = remainingMs <= 0
  const nowMs = Date.now()
  const extendWindowOpen =
    new Date(extendDeadlineAt).getTime() >= nowMs
  const canExtend = !extendedOnce && extendWindowOpen

  useEffect(() => {
    if (!metricaOffer || isExpired) return
    let cancelled = false
    let fired = false

    const check = async () => {
      if (cancelled || fired) return
      try {
        const res = await fetch(
          `/api/redeem-tokens/${encodeURIComponent(tokenId)}/used`,
        )
        if (!res.ok) return
        const body = (await res.json()) as { usedAt?: string | null }
        if (!body.usedAt) return
        fired = true
        trackGoal('offer_redeemed', {
          restaurant_slug: metricaOffer.restaurantSlug,
          estimated_savings: metricaOffer.estimatedSavingsTenge,
          offer_type: metricaOffer.offerType,
        })
      } catch {
        /* ignore */
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [metricaOffer, isExpired, tokenId])

  const masked = '•'.repeat(Math.min(tokenCode.length, 8))

  const timerLabel = isExpired ? 'Код истёк' : `Осталось: ${formatTime(remainingMs)}`

  const shell = isExpired
    ? 'border border-red-200 bg-red-50 text-red-900'
    : 'border border-accent bg-accent text-white'

  return (
    <div className={`mt-8 rounded-3xl p-6 ${shell}`}>
      <p
        className={`text-sm ${isExpired ? 'text-red-700' : 'text-white/70'}`}
      >
        {isExpired ? 'Срок действия завершён' : 'Покажите QR или назовите код персоналу'}
      </p>

      <div
        className={`mt-4 flex justify-center rounded-2xl bg-white p-3 ${isExpired ? 'opacity-90' : ''}`}
      >
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR для персонала" width={200} height={200} />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center text-xs text-gray-500">
            QR…
          </div>
        )}
      </div>

      <p className={`mt-2 text-center text-xs ${isExpired ? 'text-red-600' : 'text-white/70'}`}>
        Скан открывает страницу подтверждения в приложении персонала
      </p>

      <div className="mt-5 flex flex-col items-center gap-2">
        <p
          className={`text-4xl font-semibold tracking-[0.2em] ${isExpired ? 'text-red-900' : ''}`}
        >
          {showCode ? tokenCode : masked}
        </p>
        <button
          type="button"
          onClick={() => setShowCode((v) => !v)}
          className={`text-sm font-medium underline-offset-2 hover:underline ${
            isExpired ? 'text-red-800' : 'text-white/90'
          }`}
        >
          {showCode ? 'Скрыть код' : 'Показать код'}
        </button>
      </div>

      <p
        className={`mt-4 text-sm font-medium ${isExpired ? 'text-red-800' : 'text-white/90'}`}
      >
        {timerLabel}
      </p>

      {!isExpired ? (
        <p className={`mt-1 text-sm ${isExpired ? 'text-red-700' : 'text-white/80'}`}>
          Персонал подтверждает код на своём устройстве (нужна сессия до 7 дней после PIN).
        </p>
      ) : (
        <p className="mt-1 text-sm text-red-700">
          Этот код больше не действителен для сканирования по таймеру. Продлите или получите
          новый.
        </p>
      )}

      {extendState?.error ? (
        <div className="mt-3 rounded-lg bg-red-100/30 px-3 py-2 text-sm text-red-800">
          {extendState.error}
        </div>
      ) : null}

      {canExtend ? (
        <form action={extendFormAction} className="mt-4">
          <input type="hidden" name="tokenId" value={tokenId} />
          <input type="hidden" name="restaurantId" value={restaurantId} />
          <input type="hidden" name="offerId" value={offerId} />
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={extendPending}
          >
            {extendPending ? 'Продление…' : 'Продлить ещё на 10 минут'}
          </Button>
          <p
            className={`mt-2 text-center text-xs ${isExpired ? 'text-red-700' : 'text-white/75'}`}
          >
            Один раз в течение часа с момента выдачи
          </p>
        </form>
      ) : null}

      {isExpired ? (
        <form action={generateRedeemToken} className="mt-4">
          <input type="hidden" name="restaurantId" value={restaurantId} />
          <input type="hidden" name="offerId" value={offerId} />
          <Button type="submit" variant="secondary" className="w-full">
            Получить новый
          </Button>
        </form>
      ) : null}
    </div>
  )
}
