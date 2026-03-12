'use client'

import { useEffect, useMemo, useState } from 'react'

type RedeemTokenCardProps = {
  tokenCode: string
  expiresAt: string
}

function getRemainingMs(expiresAt: string) {
  return new Date(expiresAt).getTime() - Date.now()
}

function formatTime(ms: number) {
  if (ms <= 0) return 'Истёк'

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function RedeemTokenCard({
  tokenCode,
  expiresAt,
}: RedeemTokenCardProps) {
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(expiresAt))

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(getRemainingMs(expiresAt))
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const isExpired = remainingMs <= 0

  const statusLabel = useMemo(() => {
    if (isExpired) return 'Код истёк'
    return `Осталось: ${formatTime(remainingMs)}`
  }, [isExpired, remainingMs])

  return (
    <div
      className={`mt-8 rounded-3xl p-6 ${
        isExpired
          ? 'border border-red-200 bg-red-50 text-red-900'
          : 'border border-black bg-black text-white'
      }`}
    >
      <p className={`text-sm ${isExpired ? 'text-red-700' : 'text-white/70'}`}>
        {isExpired ? 'Срок действия завершён' : 'Ваш активный код'}
      </p>

      <p className="mt-3 text-5xl font-semibold tracking-[0.2em]">
        {tokenCode}
      </p>

      <p className={`mt-4 text-sm ${isExpired ? 'text-red-700' : 'text-white/80'}`}>
        {isExpired
          ? 'Этот код больше нельзя использовать. Сгенерируйте новый код.'
          : 'Покажите этот код сотруднику ресторана.'}
      </p>

      <p className={`mt-2 text-sm font-medium ${isExpired ? 'text-red-800' : 'text-white/90'}`}>
        {statusLabel}
      </p>
    </div>
  )
}