'use client'

// Единый экран чекаута: оффер + телефон + «Оплатить» → виджет TipTop → успех.
// OTP и чекбокс согласия до оплаты удалены. Сессию выдаёт только /api/checkout/complete
// после Pay-вебхука (не коллбэк виджета).

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { PhoneInput } from '@/components/phone-input'
import {
  formatKZPhoneFromDigits,
  isKZNumber,
  normalizeToE164Like,
} from '@/lib/kz-phone'
import { trackGoal, setUserId } from '@/lib/analytics-client'
import { useUser } from '@/lib/auth/use-user'
import { DEFAULT_CITY, CITY_COOKIE, isCity } from '@/lib/cities'
import { PRICE_KZT, formatPriceKzt, formatPricePerMonth } from '@/lib/pricing'
import {
  trackMetaPixelInitiateCheckout,
  trackMetaPixelPurchase,
} from '@/lib/meta-pixel-client'
import {
  buildInitiateCheckoutEventId,
  buildTipTopPurchaseEventId,
} from '@/lib/meta-purchase'
import { readUtmFromCookie } from '@/components/analytics/utm-capture'

declare global {
  interface Window {
    tiptop?: {
      Widget: new () => {
        start: (p: object) => Promise<{ status?: string; type?: string }>
      }
    }
  }
}

const WIDGET_SRC = 'https://widget.tiptoppay.kz/bundles/widget.js'
const SUPPORT_WA =
  'https://wa.me/77066059899?text=' +
  encodeURIComponent('Здравствуйте! Нужна помощь с подпиской Kudaclub.')
const COMPLETE_POLL_MS = 2000
const COMPLETE_TIMEOUT_MS = 60_000

type ModalUser = { id: string; phone: string } | null
type Step =
  | 'checkout'
  | 'confirming'
  | 'success'
  | 'needs_otp'
  | 'processing'
  | 'fail'
  | 'fix_phone'

function readCityFromCookie(): string {
  if (typeof document === 'undefined') return DEFAULT_CITY
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CITY_COOKIE}=`))
  const value = match?.split('=')[1]
  return value && isCity(value) ? value : DEFAULT_CITY
}

function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length < 11) return e164
  // +7 7XX *--XX
  const a = digits.slice(1, 4)
  const tail = digits.slice(-2)
  return `+7 ${a} *--${tail}`
}

function displayPhone(raw: string): string {
  const e164 = normalizeToE164Like(raw)
  if (e164 && isKZNumber(e164)) {
    return formatKZPhoneFromDigits(e164.slice(1))
  }
  return raw
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
  const [step, setStep] = useState<Step>('checkout')
  const [phone, setPhone] = useState(() =>
    user?.phone ? displayPhone(user.phone) : '',
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paidPhone, setPaidPhone] = useState<string | null>(null)
  const [fixNote, setFixNote] = useState('')
  const [fixSent, setFixSent] = useState(false)
  const phoneFilledRef = useRef(false)
  const widgetOpenedRef = useRef(false)
  const paidRef = useRef(false)
  const externalIdRef = useRef<string | null>(null)
  const existingAccountRef = useRef(false)

  const phoneE164 = normalizeToE164Like(phone)
  const phoneValid = Boolean(phoneE164 && isKZNumber(phoneE164))

  useEffect(() => {
    setMounted(true)
    trackGoal('checkout_open', { source })
    const eventTime = Math.floor(Date.now() / 1000)
    trackMetaPixelInitiateCheckout(
      { value: PRICE_KZT, currency: 'KZT' },
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
      if (widgetOpenedRef.current && !paidRef.current) {
        trackGoal('payment_abandoned', { source })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phoneValid && !phoneFilledRef.current) {
      phoneFilledRef.current = true
      trackGoal('phone_filled', { source })
    }
  }, [phoneValid, source])

  const pollComplete = useCallback(async () => {
    setStep('confirming')
    const started = Date.now()
    while (Date.now() - started < COMPLETE_TIMEOUT_MS) {
      try {
        const res = await fetch('/api/checkout/complete', { method: 'POST' })
        const data = (await res.json()) as {
          status?: string
          phone?: string
          userId?: string
        }
        if (data.status === 'authenticated') {
          paidRef.current = true
          if (data.userId) setUserId(data.userId)
          if (data.phone) setPaidPhone(data.phone)
          trackGoal('purchase', { source })
          const invoiceId = externalIdRef.current
          if (invoiceId) {
            trackMetaPixelPurchase(
              { value: PRICE_KZT, currency: 'KZT' },
              buildTipTopPurchaseEventId(invoiceId),
            )
          }
          void refresh()
          setStep('success')
          return
        }
        if (data.status === 'needs_otp') {
          paidRef.current = true
          if (data.phone) setPaidPhone(data.phone)
          trackGoal('purchase', { source })
          const invoiceId = externalIdRef.current
          if (invoiceId) {
            trackMetaPixelPurchase(
              { value: PRICE_KZT, currency: 'KZT' },
              buildTipTopPurchaseEventId(invoiceId),
            )
          }
          setStep('needs_otp')
          return
        }
        if (data.status === 'invalid' || data.status === 'error') {
          break
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, COMPLETE_POLL_MS))
    }
    // Вебхук не успел — не ошибка, доступ придёт в WhatsApp.
    paidRef.current = true
    setStep('processing')
  }, [refresh, source])

  const launchWidget = useCallback(
    async (normalizedPhone: string) => {
      const tiptop = window.tiptop
      if (!tiptop) {
        setError('Платёжный виджет ещё загружается. Попробуйте через секунду.')
        setBusy(false)
        return
      }
      setBusy(true)
      setError('')
      widgetOpenedRef.current = true
      trackGoal('widget_open', { source })

      const externalId = `sub_${Date.now()}_${normalizedPhone.replace(/\D/g, '').slice(-8)}`
      externalIdRef.current = externalId
      const utm = readUtmFromCookie()

      try {
        const result = await new tiptop.Widget().start({
          publicTerminalId: process.env.NEXT_PUBLIC_TIPTOPPAY_PUBLIC_ID,
          description: 'Подписка kudaclub — 1 месяц',
          amount: PRICE_KZT,
          currency: 'KZT',
          culture: 'ru-RU',
          paymentSchema: 'Single',
          externalId,
          metadata: { source, ...utm },
          accountId: normalizedPhone,
          userInfo: {
            accountId: normalizedPhone,
            phone: normalizedPhone,
          },
          data: {
            recurrent: { interval: 'Month', period: 1 },
          },
          recurrent: {
            period: 1,
            interval: 'Month',
            amount: PRICE_KZT,
          },
        })

        if (result?.status === 'success') {
          await pollComplete()
        } else if (result?.type === 'cancel') {
          setStep('checkout')
        } else {
          setStep('fail')
          trackGoal('payment_fail', { source })
        }
      } catch {
        setStep('fail')
        trackGoal('payment_fail', { source })
      } finally {
        setBusy(false)
      }
    },
    [pollComplete, source],
  )

  const onPayClick = useCallback(async () => {
    if (!phoneValid || !phoneE164) {
      setError('Введите корректный номер телефона.')
      return
    }
    setBusy(true)
    setError('')
    trackGoal('pay_click', { source })

    try {
      const res = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneE164, source }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        phone?: string
        existing_account?: boolean
        error?: string
      }
      if (!data.ok || !data.phone) {
        setError(data.error ?? 'Не удалось начать оплату. Попробуйте ещё раз.')
        setBusy(false)
        return
      }
      existingAccountRef.current = Boolean(data.existing_account)
      setPaidPhone(data.phone)
      await launchWidget(data.phone)
    } catch {
      setError('Не удалось начать оплату. Проверьте соединение.')
      setBusy(false)
    }
  }, [launchWidget, phoneE164, phoneValid, source])

  const submitFixPhone = useCallback(async () => {
    if (!fixNote.trim()) {
      setError('Опишите, какой номер нужно привязать.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/support/phone-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPhone: paidPhone,
          message: fixNote.trim(),
        }),
      })
      if (!res.ok) throw new Error('fail')
      setFixSent(true)
    } catch {
      setError('Не удалось отправить. Напишите в поддержку в WhatsApp.')
    } finally {
      setBusy(false)
    }
  }, [fixNote, paidPhone])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={16} strokeWidth={1.8} />
        </button>

        {step === 'checkout' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              {formatPricePerMonth()}
            </h3>
            <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.45] text-neutral-600">
              <li>· Офферы 2 за 1 в заведениях-партнёрах</li>
              <li>· Подарки к заказу и спецпредложения</li>
              <li>· Отмена в любой момент в 2 клика</li>
            </ul>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void onPayClick()
              }}
            >
              <label className="text-[13px] font-medium text-neutral-700">
                Номер телефона
              </label>
              <PhoneInput
                subscriber={phone}
                onSubscriberChange={setPhone}
                autoFocus
                placeholder="+7 (700) 000-00-00"
                className={inputCls}
              />
              <button
                type="submit"
                disabled={busy || !phoneValid}
                className={primaryBtn}
              >
                {busy
                  ? 'Открываем оплату…'
                  : `Оплатить ${formatPriceKzt()}`}
              </button>
            </form>
            <p className="mt-3 text-[11px] leading-[1.45] text-neutral-400">
              Нажимая «Оплатить», вы принимаете{' '}
              <a
                href="/offer"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-neutral-600"
              >
                публичную оферту
              </a>{' '}
              и{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-neutral-600"
              >
                политику обработки данных
              </a>
              . Списание {formatPriceKzt()} ежемесячно, отмена в любой момент в
              2 клика.
            </p>
          </>
        )}

        {step === 'confirming' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Подтверждаем оплату…
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Это займёт несколько секунд. Не закрывайте окно.
            </p>
          </>
        )}

        {step === 'processing' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Оплата обрабатывается
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Доступ придёт в WhatsApp. Обычно это занимает до минуты.
            </p>
            <a href={`/${readCityFromCookie()}`} className={`${primaryBtn} mt-4`}>
              На главную
            </a>
          </>
        )}

        {step === 'success' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Оплата прошла!
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Подписка привязана к{' '}
              {paidPhone ? maskPhone(paidPhone) : 'вашему номеру'}.
            </p>
            <div className="mt-4 rounded-lg bg-neutral-50 px-3.5 py-3 text-[13px] leading-[1.5] text-neutral-700">
              <p className="font-medium text-neutral-900">Как пользоваться</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>Откройте заведение в каталоге</li>
                <li>Покажите оффер официанту или на кассе</li>
                <li>Скидка применяется при оплате счёта</li>
              </ol>
            </div>
            <a href={`/${readCityFromCookie()}`} className={`${primaryBtn} mt-4`}>
              На главную
            </a>
            <button
              type="button"
              onClick={() => {
                setFixSent(false)
                setFixNote('')
                setStep('fix_phone')
              }}
              className="mt-2 w-full text-center text-[13px] text-neutral-500 underline-offset-2 hover:text-neutral-800"
            >
              Исправить номер
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

        {step === 'needs_otp' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Оплата прошла!
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Подписка привязана к{' '}
              {paidPhone ? maskPhone(paidPhone) : 'вашему номеру'}. Для входа в
              кабинет подтвердите номер кодом из WhatsApp.
            </p>
            <a
              href={`/login?phone=${encodeURIComponent(paidPhone ?? '')}`}
              className={`${primaryBtn} mt-4`}
            >
              Войти по коду
            </a>
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

        {step === 'fix_phone' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Исправить номер
            </h3>
            {fixSent ? (
              <>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
                  Запрос отправлен в поддержку. Мы свяжемся с вами в WhatsApp.
                </p>
                <a href={`/${readCityFromCookie()}`} className={`${primaryBtn} mt-4`}>
                  На главную
                </a>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
                  Текущий номер:{' '}
                  {paidPhone ? maskPhone(paidPhone) : 'не указан'}. Напишите
                  правильный номер — создадим тикет поддержке.
                </p>
                <textarea
                  value={fixNote}
                  onChange={(e) => setFixNote(e.target.value)}
                  rows={3}
                  placeholder="Правильный номер: +7…"
                  className={`${inputCls} mt-3 resize-none`}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitFixPhone()}
                  className={`${primaryBtn} mt-3`}
                >
                  {busy ? 'Отправляем…' : 'Отправить в поддержку'}
                </button>
              </>
            )}
          </>
        )}

        {step === 'fail' && (
          <>
            <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
              Оплата не прошла
            </h3>
            <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
              Деньги не списаны. Попробуйте ещё раз или другой картой.
            </p>
            <button
              type="button"
              onClick={() => setStep('checkout')}
              className={`${primaryBtn} mt-4`}
            >
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
    document.body,
  )
}
