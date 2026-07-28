'use client'

// src/components/checkout/checkout-modal.tsx
// Чекаут-модалка: телефон → код в WhatsApp → виджет TipTop Pay → успех/ошибка.
// Залогиненному пользователю показывается сразу шаг оплаты.
// Доступ к подписке открывает ТОЛЬКО Pay-вебхук на сервере, не этот коллбэк.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { PhoneInput } from '@/components/phone-input'
import { normalizeToE164Like } from '@/lib/kz-phone'
import { sendCheckoutOtp } from '@/lib/checkout/otp-actions'
import { verifyWhatsAppLoginCode } from '@/app/login/actions'
import { trackGoal, setUserId } from '@/lib/analytics-client'
import { useUser } from '@/lib/auth/use-user'
import { DEFAULT_CITY, CITY_COOKIE, isCity } from '@/lib/cities'
import {
  META_SUBSCRIPTION_PRICE_KZT,
  trackMetaPixelInitiateCheckout,
  trackMetaPixelPurchase,
} from '@/lib/meta-pixel-client'
import {
  buildInitiateCheckoutEventId,
  buildTipTopPurchaseEventId,
} from '@/lib/meta-purchase'

declare global {
  interface Window {
    tiptop?: { Widget: new () => { start: (p: object) => Promise<{ status?: string; type?: string }> } }
  }
}

const WIDGET_SRC = 'https://widget.tiptoppay.kz/bundles/widget.js'
const PRICE = 1990
const SUPPORT_WA =
  'https://wa.me/77066059899?text=' +
  encodeURIComponent('Здравствуйте! Не прошла оплата подписки Kudaclub.')

type ModalUser = { id: string; phone: string } | null
type Step = 'phone' | 'otp' | 'pay' | 'success' | 'fail'

function readCityFromCookie(): string {
  if (typeof document === 'undefined') return DEFAULT_CITY
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CITY_COOKIE}=`))
  const value = match?.split('=')[1]
  return value && isCity(value) ? value : DEFAULT_CITY
}

const primaryBtn =
  'flex w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60'
const inputCls =
  'w-full rounded-lg border-[0.5px] border-neutral-200 bg-white px-3.5 py-3 text-base text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary'

export default function CheckoutModal({
  user,
  source,
  onClose,
}: {
  user: ModalUser
  source: string
  onClose: () => void
}) {
  const { refresh } = useUser()
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>(user ? 'pay' : 'phone')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  // Согласие с офертой и рекуррентом — обязательно, не отмечено по умолчанию
  // (требование платёжной системы для регулярных списаний).
  const [agreed, setAgreed] = useState(false)
  const userIdRef = useRef<string | null>(user?.id ?? null)
  const widgetOpenedRef = useRef(false)
  const paidRef = useRef(false)
  const externalIdRef = useRef<string | null>(null)

  // Portal-монтирование + фон/скролл/Escape + предзагрузка виджета + аналитика.
  useEffect(() => {
    setMounted(true)
    trackGoal('checkout_opened', { source })
    const eventTime = Math.floor(Date.now() / 1000)
    trackMetaPixelInitiateCheckout(
      { value: META_SUBSCRIPTION_PRICE_KZT, currency: 'KZT' },
      buildInitiateCheckoutEventId(source, eventTime),
    )

    if (!document.querySelector(`script[src="${WIDGET_SRC}"]`)) {
      const s = document.createElement('script')
      s.src = WIDGET_SRC
      document.head.appendChild(s)
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      // Открыл виджет, но не оплатил и не на экране успеха — потеря.
      if (widgetOpenedRef.current && !paidRef.current) {
        trackGoal('payment_abandoned', { source })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const sendCode = useCallback(async () => {
    setBusy(true)
    setError('')
    const e164 = normalizeToE164Like(phone)
    if (!e164) {
      setError('Введите корректный номер телефона.')
      setBusy(false)
      return
    }
    const fd = new FormData()
    fd.set('phone', e164)
    const res = await sendCheckoutOtp(fd)
    if (res.ok) {
      setStep('otp')
      setResendIn(30)
      setCode('')
      trackGoal('phone_submitted', { source })
    } else {
      setError(res.error ?? 'Не удалось отправить код. Проверьте номер.')
    }
    setBusy(false)
  }, [phone, source])

  const verifyCode = useCallback(
    async (rawCode: string) => {
      const normalized = rawCode.replace(/\D/g, '').slice(0, 6)
      if (normalized.length !== 6) {
        setError('Введите 6-значный код.')
        return
      }
      setBusy(true)
      setError('')
      const fd = new FormData()
      fd.set('code', normalized)
      const res = await verifyWhatsAppLoginCode(fd)
      if (res.ok) {
        userIdRef.current = res.userId ?? userIdRef.current
        if (res.userId) setUserId(res.userId)
        setStep('pay')
        trackGoal('otp_verified', { source })
      } else {
        setError(res.error ?? 'Неверный код. Попробуйте ещё раз.')
      }
      setBusy(false)
    },
    [source]
  )

  const launchWidget = useCallback(() => {
    if (!agreed) {
      setError('Подтвердите согласие с офертой, чтобы продолжить.')
      return
    }
    const tiptop = window.tiptop
    if (!tiptop || !userIdRef.current) {
      setError('Платёжный виджет ещё загружается. Попробуйте через секунду.')
      return
    }
    setBusy(true)
    setError('')
    widgetOpenedRef.current = true
    trackGoal('widget_opened', { source })
    const externalId = `sub_${userIdRef.current}_${Date.now()}`
    externalIdRef.current = externalId
    new tiptop.Widget()
      .start({
        publicTerminalId: process.env.NEXT_PUBLIC_TIPTOPPAY_PUBLIC_ID,
        description: 'Подписка Kudaclub — 1 месяц',
        amount: PRICE,
        currency: 'KZT',
        culture: 'ru-RU',
        paymentSchema: 'Single',
        externalId,
        metadata: { source }, // источник CTA придёт в вебхук — для аналитики
        userInfo: { accountId: userIdRef.current, phone: normalizeToE164Like(phone) ?? phone },
        recurrent: { period: 1, interval: 'Month', amount: PRICE },
      })
      .then((r) => {
        if (r?.status === 'success') {
          paidRef.current = true
          setStep('success')
          trackGoal('payment_success', { source })
          const invoiceId = externalIdRef.current
          if (invoiceId) {
            trackMetaPixelPurchase(
              { value: META_SUBSCRIPTION_PRICE_KZT, currency: 'KZT' },
              buildTipTopPurchaseEventId(invoiceId),
            )
          }
          void refresh()
        } else if (r?.type === 'cancel') {
          setStep('pay')
        } else {
          setStep('fail')
          trackGoal('payment_fail', { source })
        }
      })
      .catch(() => {
        setStep('fail')
        trackGoal('payment_fail', { source })
      })
      .finally(() => setBusy(false))
  }, [agreed, phone, source, refresh])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={16} strokeWidth={1.8} />
        </button>

        {step === 'phone' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Подписка Kudaclub — {PRICE.toLocaleString('ru-RU')} ₸/мес
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Введите номер — отправим код подтверждения в WhatsApp.
            </p>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void sendCode()
              }}
            >
              <PhoneInput
                subscriber={phone}
                onSubscriberChange={setPhone}
                autoFocus
                placeholder="+7 700 000 00 00"
                className={inputCls}
              />
              <button
                type="submit"
                disabled={busy || phone.replace(/\D/g, '').length < 10}
                className={primaryBtn}
              >
                {busy ? 'Отправляем…' : 'Получить код'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Код отправлен в WhatsApp
            </h3>
            <p className="mt-1.5 text-[13px] text-neutral-500">на номер {phone}</p>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void verifyCode(code)
              }}
            >
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                data-ym-disable-keys
                placeholder="123456"
                value={code}
                autoFocus
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(next)
                  if (!busy && next.length === 6) void verifyCode(next)
                }}
                className={`${inputCls} text-center tracking-[0.3em]`}
              />
              <button type="submit" disabled={busy || code.length < 4} className={primaryBtn}>
                {busy ? 'Проверяем…' : 'Подтвердить'}
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
                className="text-center text-[13px] text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-800 disabled:opacity-60"
              >
                {resendIn > 0 ? `Отправить ещё раз через ${resendIn} с` : 'Отправить ещё раз'}
              </button>
            </form>
          </>
        )}

        {step === 'pay' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">Оплата подписки</h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              {PRICE.toLocaleString('ru-RU')} ₸ сегодня, далее автоматически раз в месяц. Отменить можно
              в любой момент в личном кабинете.
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.45] text-neutral-600">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
              />
              <span>
                Я согласен с{' '}
                <a
                  href="/offer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:opacity-80"
                >
                  публичной офертой
                </a>{' '}
                и регулярными ежемесячными списаниями.
              </span>
            </label>
            <button
              type="button"
              disabled={busy || !agreed}
              onClick={launchWidget}
              className={`${primaryBtn} mt-4`}
            >
              {busy ? 'Открываем оплату…' : 'Оплатить картой'}
            </button>
          </>
        )}

        {step === 'success' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">Подписка активна 🎉</h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Оплата прошла. Доступ откроется в течение минуты — офферы 2 за 1 уже почти у вас.
            </p>
            <a href={`/${readCityFromCookie()}`} className={`${primaryBtn} mt-4`}>
              К заведениям
            </a>
          </>
        )}

        {step === 'fail' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">Оплата не прошла</h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Деньги не списаны. Попробуйте ещё раз или другой картой.
            </p>
            <button type="button" onClick={() => setStep('pay')} className={`${primaryBtn} mt-4`}>
              Попробовать ещё раз
            </button>
            <a
              href={SUPPORT_WA}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-center text-[13px] text-neutral-500 underline-offset-2 hover:text-neutral-800"
            >
              Написать в поддержку
            </a>
          </>
        )}

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] leading-[1.5] text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
