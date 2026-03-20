'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { OtpInput8 } from '@/components/otp-input-8'

function toFriendlyOtpError(message: string | null | undefined) {
  const text = (message ?? '').toLowerCase()

  // В Supabase формулировки зависят от провайдера, поэтому матчим по ключевым словам.
  if (
    text.includes('invalid') ||
    text.includes('otp') && text.includes('code') ||
    text.includes('token') && text.includes('invalid')
  ) {
    return 'Неверный код. Проверьте цифры и попробуйте снова.'
  }

  if (
    text.includes('too many') ||
    text.includes('rate') ||
    text.includes('limit') ||
    text.includes('attempt')
  ) {
    return 'Слишком много попыток. Повторите запрос через некоторое время.'
  }

  if (text.includes('server') || text.includes('unexpected') || text.includes('error')) {
    return 'Ошибка сервера. Попробуйте позже.'
  }

  return message ?? 'Произошла ошибка. Попробуйте позже.'
}

export default function PhoneLoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const [phone, setPhone] = useState('')
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)

  const [requestLoading, setRequestLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [resendAt, setResendAt] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const [otpResetKey, setOtpResetKey] = useState(0)

  useEffect(() => {
    if (resendAt === null) return

    const id = window.setInterval(() => {
      const leftMs = resendAt - Date.now()
      const leftSec = Math.max(0, Math.ceil(leftMs / 1000))
      setSecondsLeft(leftSec)
      if (leftSec <= 0) {
        window.clearInterval(id)
      }
    }, 250)

    return () => window.clearInterval(id)
  }, [resendAt])

  const startOtp = async (phoneToSend: string) => {
    const cleanPhone = phoneToSend.trim()
    if (!cleanPhone) {
      setError('Введите номер телефона.')
      return
    }

    setError(null)
    setMessage(null)
    setRequestLoading(true)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      phone: cleanPhone,
    })

    if (signInError) {
      setRequestLoading(false)
      setError(toFriendlyOtpError(signInError.message))
      return
    }

    setPendingPhone(cleanPhone)
    setMessage('Мы отправили SMS-код.')
    setOtpResetKey((v) => v + 1)

    const nextResendAt = Date.now() + 60_000
    setResendAt(nextResendAt)
    setSecondsLeft(60)

    setRequestLoading(false)
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (requestLoading || otpLoading) return
    await startOtp(phone)
  }

  const handleResend = async () => {
    if (!pendingPhone) return
    if (requestLoading || otpLoading) return
    if (secondsLeft > 0) return
    await startOtp(pendingPhone)
  }

  const handleComplete = async (code: string) => {
    if (!pendingPhone) return
    if (otpLoading) return

    setOtpLoading(true)
    setError(null)
    setMessage(null)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: code,
      type: 'sms',
    })

    if (verifyError) {
      setOtpLoading(false)
      setError(toFriendlyOtpError(verifyError.message))
      return
    }

    router.push('/app/me')
    router.refresh()
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Вход по телефону</h1>
          <Link href="/login" className="text-sm text-gray-500 underline">
            Назад
          </Link>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          {!pendingPhone ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-medium text-gray-700">
                  Номер телефона
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7XXXXXXXXXX"
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Введите номер в формате `+7XXXXXXXXXX` или `8XXXXXXXXXX`.
                </p>
              </div>

              <button
                type="submit"
                disabled={requestLoading}
                className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {requestLoading ? 'Отправляем...' : 'Получить SMS-код'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="text-sm text-gray-600">
                <p>
                  SMS-код отправлен на: <span className="font-medium text-gray-900">{pendingPhone}</span>
                </p>
                <p className="mt-1">Ввод начнётся автоматически на Android (WebOTP).</p>
              </div>

              <OtpInput8
                key={otpResetKey}
                disabled={otpLoading}
                onComplete={handleComplete}
              />

              <button
                type="button"
                disabled
                className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-400"
                title="Код подтверждается автоматически после ввода 8 цифр."
              >
                {otpLoading ? 'Проверяем...' : 'Код подтверждается автоматически'}
              </button>

              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={requestLoading || otpLoading || secondsLeft > 0}
                    className="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {secondsLeft > 0 ? `Отправить повторно (${secondsLeft})` : 'Отправить код ещё раз'}
                  </button>

                  <p className="text-xs text-gray-500">
                    Повторный запрос доступен через 60 секунд.
                  </p>
                </div>
              </div>
            </div>
          )}

          {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </main>
  )
}

