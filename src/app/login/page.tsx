'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { sendWhatsAppLogin } from './actions'
import type { EmailOtpType } from '@supabase/supabase-js'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [pendingVerifyType, setPendingVerifyType] = useState<EmailOtpType>('magiclink')
  const [loading, setLoading] = useState(false)
  const [whatsAppLoading, setWhatsAppLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Мы отправили ссылку для входа на вашу почту.')
    }

    setLoading(false)
  }

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
      setPendingEmail(result.pendingEmail ?? null)
      setPendingVerifyType(result.verifyType ?? 'magiclink')
      setOtpCode('')
    }

    setWhatsAppLoading(false)
  }

  const handleVerifyWhatsAppCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingEmail) {
      setError('Сначала запросите код в WhatsApp.')
      return
    }

    setOtpLoading(true)
    setMessage(null)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: otpCode.trim(),
      type: pendingVerifyType,
    })

    if (error) {
      setError(error.message)
      setOtpLoading(false)
      return
    }

    router.push('/app/me')
    router.refresh()
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Вход</h1>
        <p className="mt-3 text-gray-600">
          Войдите по email, WhatsApp или телефону (SMS OTP), чтобы оформить подписку и активировать офферы.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Отправка...' : 'Получить ссылку для входа'}
          </button>
        </form>

        <div className="mt-4">
          <Link
            href="/login/phone"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-black"
          >
            Войти по телефону (SMS OTP)
          </Link>
        </div>

        <div className="my-6 h-px bg-gray-200" />

        <form onSubmit={handleWhatsAppLogin} className="space-y-4">
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

        {pendingEmail ? (
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
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm tracking-[0.2em] outline-none"
              />
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