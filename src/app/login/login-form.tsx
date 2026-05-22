'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PhoneInput, normalizeToE164Like } from '@/components/phone-input'
import { formatPhoneForDisplay } from '@/lib/kz-phone'
import { sendWhatsAppLogin, verifyWhatsAppLoginCode } from './actions'
import { setUserId } from '@/lib/analytics-client'
import { WhatsappGoalLink } from '@/components/analytics/whatsapp-goal-link'

export function LoginForm({
  safeNext,
  presetPhone,
  activationToken,
}: {
  safeNext?: string
  presetPhone?: string
  activationToken?: string
}) {
  const router = useRouter()
  const [subscriber, setSubscriber] = useState(() => presetPhone ?? '')
  const [otpCode, setOtpCode] = useState('')
  const [codeRequested, setCodeRequested] = useState(false)
  const [whatsAppLoading, setWhatsAppLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noAccount, setNoAccount] = useState(false)
  const isPhoneLocked = Boolean(presetPhone)

  const normalizeOtpCode = (value: string) => value.replace(/\D/g, '').slice(0, 6)

  const redirectAfterLogin = () => {
    router.push(safeNext ?? '/app/me')
    router.refresh()
  }

  const resetToLogin = () => {
    setNoAccount(false)
    setError(null)
    setMessage(null)
    setOtpCode('')
    setCodeRequested(false)
    if (!isPhoneLocked) {
      setSubscriber('')
    }
  }

  const handleWhatsAppLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWhatsAppLoading(true)
    setMessage(null)
    setError(null)
    setNoAccount(false)

    const phoneE164 = normalizeToE164Like(subscriber)
    if (!phoneE164) {
      setError('Введите полный номер телефона (с кодом страны, например +7…).')
      setWhatsAppLoading(false)
      return
    }

    const formData = new FormData()
    formData.set('phone', phoneE164)
    if (activationToken) {
      formData.set('activation_token', activationToken)
    }
    const result = await sendWhatsAppLogin(formData)

    if (!result.ok) {
      if (result.code === 'no_account') {
        setNoAccount(true)
      } else {
        setError(result.error ?? 'Не удалось отправить сообщение.')
      }
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

    if (result.userId) {
      setUserId(result.userId)
    }

    redirectAfterLogin()
  }

  const handleVerifyWhatsAppCode = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitWhatsAppCode(otpCode)
  }

  const inputClassName =
    'w-full bg-white text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-[#D85A30]'
  const inputStyle: React.CSSProperties = {
    borderWidth: '0.5px',
    borderStyle: 'solid',
    borderColor: 'rgb(229 229 229)',
    borderRadius: '8px',
    padding: '11px 14px',
  }

  if (noAccount) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
        <div
          className="relative w-full max-w-sm bg-white"
          style={{
            borderWidth: '0.5px',
            borderStyle: 'solid',
            borderColor: 'rgb(229 229 229)',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h1
            className="font-medium text-neutral-900"
            style={{ fontSize: '20px', lineHeight: 1.3, letterSpacing: '-0.2px' }}
          >
            У вас ещё нет подписки Kudaclub
          </h1>
          <p
            className="text-neutral-500"
            style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '8px' }}
          >
            На номер {formatPhoneForDisplay(subscriber) || subscriber} аккаунт не найден.
            Чтобы получить доступ к 2-за-1, оформите подписку — мы пришлём ссылку
            активации в WhatsApp.
          </p>

          <WhatsappGoalLink
            source="login-no-account"
            messageKind="login-no-account"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center font-medium text-white transition-opacity hover:opacity-95"
            style={{
              background: '#D85A30',
              borderRadius: '8px',
              padding: '11px 20px',
              fontSize: '14px',
            }}
          >
            Оформить за 1 990 ₸
          </WhatsappGoalLink>

          <button
            type="button"
            onClick={resetToLogin}
            className="mt-3 block w-full text-center text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-700 hover:underline"
            style={{ fontSize: '12px' }}
          >
            Вернуться к входу
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <div
        className="relative w-full max-w-sm bg-white"
        style={{
          borderWidth: '0.5px',
          borderStyle: 'solid',
          borderColor: 'rgb(229 229 229)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h1
          className="font-medium text-neutral-900"
          style={{ fontSize: '20px', lineHeight: 1.3, letterSpacing: '-0.2px' }}
        >
          Вход через WhatsApp
        </h1>
        <p
          className="text-neutral-500"
          style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px' }}
        >
          Введите номер и подтвердите код из WhatsApp.
        </p>

        <form onSubmit={handleWhatsAppLogin} style={{ marginTop: '20px' }}>
          <div>
            <label
              htmlFor="phone"
              className="block font-medium text-neutral-700"
              style={{ fontSize: '13px', marginBottom: '6px' }}
            >
              Номер телефона
            </label>
            <PhoneInput
              id="phone"
              subscriber={subscriber}
              onSubscriberChange={setSubscriber}
              readOnly={isPhoneLocked}
              placeholder="Например: +77001234567"
              className={inputClassName}
              style={inputStyle}
            />
            {isPhoneLocked ? (
              <p
                className="text-neutral-500"
                style={{ fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}
              >
                Войдите с номера {formatPhoneForDisplay(subscriber)}
              </p>
            ) : (
              <p
                className="text-neutral-500"
                style={{ fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}
              >
                Для Казахстана можно +7…, 8… или 7… (11 цифр). Для других стран — с «+» и кодом.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={whatsAppLoading}
            className="flex w-full items-center justify-center font-medium text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: '#D85A30',
              borderRadius: '8px',
              padding: '11px 20px',
              fontSize: '14px',
              marginTop: '16px',
            }}
          >
            {whatsAppLoading ? 'Отправка…' : 'Получить код'}
          </button>
        </form>

        {codeRequested ? (
          <form onSubmit={handleVerifyWhatsAppCode} style={{ marginTop: '16px' }}>
            <div>
              <label
                htmlFor="otp"
                className="block font-medium text-neutral-700"
                style={{ fontSize: '13px', marginBottom: '6px' }}
              >
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
                data-ym-disable-keys
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
                className="w-full bg-white text-center text-neutral-900 outline-none transition-colors placeholder:text-neutral-300 focus:border-[#D85A30]"
                style={{
                  ...inputStyle,
                  letterSpacing: '0.3em',
                  fontSize: '16px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={otpLoading}
              className="flex w-full items-center justify-center bg-white font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderWidth: '0.5px',
                borderStyle: 'solid',
                borderColor: 'rgb(229 229 229)',
                borderRadius: '8px',
                padding: '11px 20px',
                fontSize: '14px',
                marginTop: '16px',
              }}
            >
              {otpLoading ? 'Проверка…' : 'Подтвердить'}
            </button>
          </form>
        ) : null}

        {message ? (
          <div
            className="text-emerald-700"
            style={{
              background: '#ECFDF5',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              lineHeight: 1.5,
              marginTop: '16px',
            }}
          >
            {message}
          </div>
        ) : null}
        {error ? (
          <div
            className="text-red-700"
            style={{
              background: '#FEF2F2',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              lineHeight: 1.5,
              marginTop: '16px',
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          className="text-center"
          style={{ marginTop: '20px' }}
        >
          <Link
            href="/staff/login"
            className="text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-700 hover:underline"
            style={{ fontSize: '12px' }}
          >
            Вход для персонала
          </Link>
        </div>
      </div>
    </div>
  )
}
