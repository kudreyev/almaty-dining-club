'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PhoneInput,
  formatKZPhoneFromDigits,
  isKZNumber,
  normalizeToE164Like,
} from '@/components/phone-input'
import { sendWhatsAppLogin, verifyWhatsAppLoginCode } from './actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function LoginForm({
  safeNext,
  presetPhone,
}: {
  safeNext?: string
  presetPhone?: string
}) {
  const router = useRouter()
  const [subscriber, setSubscriber] = useState(() => presetPhone ?? '')
  const [otpCode, setOtpCode] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [whatsAppLoading, setWhatsAppLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isPhoneLocked = Boolean(presetPhone)

  const normalizeOtpCode = (value: string) => value.replace(/\D/g, '').slice(0, 6)

  const redirectAfterLogin = () => {
    router.push(safeNext ?? '/app/me')
    router.refresh()
  }

  const handleWhatsAppLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWhatsAppLoading(true)
    setMessage(null)
    setError(null)

    const phoneE164 = normalizeToE164Like(subscriber)
    if (!phoneE164) {
      setError('Введите полный номер телефона.')
      setWhatsAppLoading(false)
      return
    }
    if (!isKZNumber(phoneE164)) {
      setError('Пока поддерживаем только номера Казахстана (+7 ...).')
      setWhatsAppLoading(false)
      return
    }

    const formData = new FormData()
    formData.set('phone', phoneE164)
    const result = await sendWhatsAppLogin(formData)

    if (!result.ok) {
      setError(result.error ?? 'Не удалось отправить сообщение.')
    } else {
      setMessage(result.message ?? 'Код отправлен в WhatsApp.')
      setCodeRequested(true)
      setOtpCode('')
    }

    setWhatsAppLoading(false)
  }

  const submitWhatsAppCode = async (rawCode: string) => {
    if (!codeRequested) {
      setError('Сначала запросите код.')
      return
    }

    const code = normalizeOtpCode(rawCode)
    if (code.length !== 6) {
      setError('Введите 6-значный код.')
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

    redirectAfterLogin()
  }

  const handleVerifyWhatsAppCode = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitWhatsAppCode(otpCode)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <Card className="w-full max-w-sm" padding="lg">
        <h1 className="text-xl font-bold">Вход через WhatsApp</h1>
        <p className="mt-2 text-sm text-gray-500">
          Введите номер и подтвердите код из WhatsApp.
        </p>

        <form onSubmit={handleWhatsAppLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">
              Номер телефона
            </label>
            <PhoneInput
              id="phone"
              subscriber={subscriber}
              onSubscriberChange={setSubscriber}
              readOnly={isPhoneLocked}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-black"
            />
            {isPhoneLocked ? (
              <p className="mt-1 text-xs text-gray-400">
                Войдите с номера{' '}
                {(() => {
                  const normalized = normalizeToE164Like(subscriber)
                  if (!normalized) return subscriber
                  if (!isKZNumber(normalized)) return normalized
                  return formatKZPhoneFromDigits(normalized.slice(1))
                })()}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={whatsAppLoading}
            className="w-full"
          >
            {whatsAppLoading ? 'Отправка...' : 'Получить код'}
          </Button>
        </form>

        {codeRequested ? (
          <form onSubmit={handleVerifyWhatsAppCode} className="mt-4 space-y-4">
            <div>
              <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-gray-700">
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
                  if (!otpLoading && next.length === 6) await submitWhatsAppCode(next)
                }}
                onPaste={async (e) => {
                  const pasted = e.clipboardData.getData('text')
                  const next = normalizeOtpCode(pasted)
                  if (!next) return
                  e.preventDefault()
                  setOtpCode(next)
                  if (!otpLoading && next.length === 6) await submitWhatsAppCode(next)
                }}
                placeholder="123456"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm tracking-[0.3em] outline-none transition-colors focus:border-black"
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
              disabled={otpLoading}
              className="w-full"
            >
              {otpLoading ? 'Проверка...' : 'Подтвердить'}
            </Button>
          </form>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
