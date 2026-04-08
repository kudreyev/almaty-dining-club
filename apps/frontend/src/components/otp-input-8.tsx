'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type OtpInput8Props = {
  onComplete: (code: string) => void
  disabled?: boolean
  className?: string
  autoFocus?: boolean
}

const OTP_LENGTH = 8

function isDigitString(value: string) {
  return /^\d+$/.test(value)
}

export function OtpInput8({
  onComplete,
  disabled = false,
  className,
  autoFocus = false,
}: OtpInput8Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState('')
  const lastCompletedCodeRef = useRef<string | null>(null)

  const boxes = useMemo(() => Array.from({ length: OTP_LENGTH }), [])

  useEffect(() => {
    // Разблокируем guard, когда пользователь меняет/очищает код.
    if (value.length < OTP_LENGTH) lastCompletedCodeRef.current = null
  }, [value])

  useEffect(() => {
    if (disabled) return
    if (value.length !== OTP_LENGTH) return
    if (lastCompletedCodeRef.current === value) return

    lastCompletedCodeRef.current = value
    onComplete(value)
  }, [value, disabled, onComplete])

  useEffect(() => {
    if (disabled) return
    if (value.length > 0) return

    // WebOTP работает в основном на Android Chrome.
    type WebOtpResult = { code?: string }
    type CredentialsWithOtp = {
      get: (options: {
        otp: { transport: string[] }
        signal: AbortSignal
      }) => Promise<WebOtpResult>
    }

    const credentials = navigator.credentials as unknown as CredentialsWithOtp
    if (!credentials?.get) return
    if (typeof AbortController === 'undefined') return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 2 * 60 * 1000)

    credentials
      .get({
        otp: { transport: ['sms'] },
        signal: controller.signal,
      })
      .then((result) => {
        const rawCode = typeof result?.code === 'string' ? result.code : ''
        const digits = rawCode.replace(/\D/g, '').slice(0, OTP_LENGTH)
        if (digits.length === OTP_LENGTH && isDigitString(digits)) {
          setValue(digits)
        }
      })
      .catch(() => {
        // Ничего не делаем: WebOTP может быть недоступен или пользователь отказал.
      })

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [disabled, value.length])

  return (
    <div
      className={className}
      onClick={() => {
        if (disabled) return
        inputRef.current?.focus()
      }}
      role="group"
      aria-label="Код подтверждения из SMS"
    >
      <div className="flex items-center justify-center gap-2">
        {boxes.map((_, idx) => {
          const digit = value[idx] ?? ''
          const filled = Boolean(digit)

          return (
            <div
              key={idx}
              className={[
                'flex h-12 w-10 items-center justify-center rounded-xl border text-center',
                filled ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-black',
                'font-semibold text-2xl tracking-[0.25em]',
              ].join(' ')}
            >
              {digit}
            </div>
          )
        })}
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="\\d*"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        disabled={disabled}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH)
          setValue(next)
        }}
        aria-label="Поле ввода кода подтверждения"
        className="sr-only"
      />
    </div>
  )
}

