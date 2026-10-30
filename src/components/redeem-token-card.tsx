'use client'

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import {
  extendRedeemToken,
  generateRedeemToken,
} from '@/app/app/redeem/[restaurantId]/[offerId]/actions'
import { getAppSiteOrigin } from '@/lib/site-url'
import { Button } from '@/components/ui/button'
import { reachMetricaGoal, trackGoal } from '@/lib/analytics-client'
import { emitValueMoment } from '@/lib/pwa/value-moment'
import { useWakeLock } from '@/hooks/use-wake-lock'
import type { OfferType } from '@/lib/offers'

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
    offerType: OfferType
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

  // В БД code_requested пишет issue_redeem_token; здесь — только цель Метрики, один раз на код.
  useEffect(() => {
    const key = `kc_code_requested_${tokenId}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      return
    }
    reachMetricaGoal('code_requested', {
      restaurant_id: restaurantId,
      offer_id: offerId,
    })
  }, [tokenId, restaurantId, offerId])

  // Момент ценности: код на экране (предложение установки — после ухода с экрана или погашения).
  useEffect(() => {
    emitValueMoment('code_shown')
  }, [tokenId])

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
  const nowMs = new Date(localExpires).getTime() - remainingMs
  const extendWindowOpen =
    new Date(extendDeadlineAt).getTime() >= nowMs
  const canExtend = !extendedOnce && extendWindowOpen
  const [redeemed, setRedeemed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const codeActive = !isExpired && !redeemed

  useWakeLock(codeActive)

  const onRedeemed = useCallback(() => {
    setRedeemed(true)
    setFullscreen(false)
    if (metricaOffer) {
      trackGoal('offer_redeemed', {
        restaurant_id: restaurantId,
        offer_id: offerId,
        restaurant_slug: metricaOffer.restaurantSlug,
        estimated_savings: metricaOffer.estimatedSavingsTenge,
        offer_type: metricaOffer.offerType,
      })
    }
    emitValueMoment('code_redeemed')
  }, [metricaOffer, restaurantId, offerId])

  useEffect(() => {
    if (!codeActive) return
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
        onRedeemed()
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
  }, [codeActive, tokenId, onRedeemed])

  const masked = '•'.repeat(Math.min(tokenCode.length, 8))

  const timerLabel = isExpired ? 'Код истёк' : `Осталось: ${formatTime(remainingMs)}`

  if (redeemed) {
    return (
      <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-900">
        <p className="text-4xl" aria-hidden="true">✓</p>
        <p className="mt-2 text-xl font-semibold">Код погашен</p>
        <p className="mt-1 text-sm text-emerald-800">Приятного аппетита! Следующий код — в каталоге.</p>
      </div>
    )
  }

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

      {!isExpired ? (
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-white px-5 py-4 text-[17px] font-semibold text-accent transition-colors hover:bg-white/90"
        >
          Показать официанту
        </button>
      ) : null}

      <div className="mt-5 flex flex-col items-center gap-2">
        <p
          className={`font-mono text-5xl font-semibold tracking-[0.18em] ${isExpired ? 'text-red-900' : ''}`}
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

      {fullscreen && !isExpired ? (
        <WaiterView
          code={tokenCode}
          qrDataUrl={qrDataUrl}
          timerLabel={timerLabel}
          onClose={() => setFullscreen(false)}
        />
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

/** Полноэкранный показ кода официанту: крупный код, QR и таймер. */
function WaiterView({
  code,
  qrDataUrl,
  timerLabel,
  onClose,
}: {
  code: string
  qrDataUrl: string | null
  timerLabel: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Код для официанта"
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-white px-6 text-neutral-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <p className="text-base text-neutral-500">Код KudaClub для официанта</p>
      <p className="mt-4 select-all break-all text-center font-mono text-[clamp(3rem,18vw,7rem)] font-bold leading-none tracking-[0.12em]">
        {code}
      </p>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="QR для персонала" width={220} height={220} className="mt-8" />
      ) : null}
      <p className="mt-6 text-lg font-medium text-neutral-700">{timerLabel}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-10 rounded-full bg-neutral-100 px-8 py-3 text-[16px] font-medium text-neutral-800 hover:bg-neutral-200"
      >
        Закрыть
      </button>
    </div>
  )
}
