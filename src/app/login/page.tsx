'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendWhatsAppLogin, verifyWhatsAppLoginCode } from './actions'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [whatsAppLoading, setWhatsAppLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const normalizeOtpCode = (value: string) => value.replace(/\D/g, '').slice(0, 6)

  const handleWhatsAppLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWhatsAppLoading(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('phone', phone)

    const result = await sendWhatsAppLogin(formData)

    if (!result.ok) {
      setError(result.error ?? 'Не удалось отправить сообщение в WhatsApp.')
    } else {
      setMessage(result.message ?? 'Мы отправили 6-значный код в WhatsApp.')
      setCodeRequested(true)
      setOtpCode('')
    }

    setWhatsAppLoading(false)
  }

  const submitWhatsAppCode = async (rawCode: string) => {
    if (!codeRequested) {
      setError('Сначала запросите код в WhatsApp.')
      return
    }

    const code = normalizeOtpCode(rawCode)
    if (code.length !== 6) {
      setError('Введите корректный 6-значный код.')
      return
    }

    setOtpLoading(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('code', code)
    const result = await verifyWhatsAppLoginCode(formData)

    if (!result.ok) {
      setError(result.error ?? 'Не удалось подтвердить код.')
      setOtpLoading(false)
      return
    }

    router.push('/app/me')
    router.refresh()
  }

  const handleVerifyWhatsAppCode = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitWhatsAppCode(otpCode)
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Вход через WhatsApp</h1>
        <p className="mt-3 text-gray-600">
          Введите номер телефона и подтвердите 6-значный код из WhatsApp.
        </p>

        <form onSubmit={handleWhatsAppLogin} className="mt-8 space-y-4">
          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-medium text-gray-700">
              WhatsApp номер
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 777 123 45 67"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
            <p className="mt-2 text-xs text-gray-500">
              Можно ввести в формате +7XXXXXXXXXX, 8XXXXXXXXXX или 7XXXXXXXXXX.
            </p>
          </div>

          <button
            type="submit"
            disabled={whatsAppLoading}
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {whatsAppLoading
              ? 'Отправка...'
              : 'Получить код в WhatsApp'}
          </button>
        </form>

        {codeRequested ? (
          <form onSubmit={handleVerifyWhatsAppCode} className="mt-4 space-y-4">
            <div>
              <label htmlFor="otp" className="mb-2 block text-sm font-medium text-gray-700">
                Код из WhatsApp
              </label>
              <input
                id="otp"
                type="text"
                required
                value={otpCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                onChange={async (e) => {
                  const next = normalizeOtpCode(e.target.value)
                  setOtpCode(next)

                  if (!otpLoading && next.length === 6) {
                    await submitWhatsAppCode(next)
                  }
                }}
                onPaste={async (e) => {
                  const pasted = e.clipboardData.getData('text')
                  const next = normalizeOtpCode(pasted)
                  if (!next) return

                  e.preventDefault()
                  setOtpCode(next)

                  if (!otpLoading && next.length === 6) {
                    await submitWhatsAppCode(next)
                  }
                }}
                placeholder="123456"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm tracking-[0.2em] outline-none"
              />
              <p className="mt-2 text-xs text-gray-500">
                Подсказка: автоподстановка зависит от ОС и может не работать для WhatsApp. Вставка кода
                поддерживается.
              </p>
            </div>

            <button
              type="submit"
              disabled={otpLoading}
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {otpLoading ? 'Проверка...' : 'Подтвердить код'}
            </button>
          </form>
        ) : null}

        {message ? (
          <p className="mt-4 text-sm text-green-600">{message}</p>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </main>
  )
}