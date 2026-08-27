'use client'

// Общая форма чекаута: оффер + телефон + оплата → виджет TipTop → успех.
// Используется в модалке и на промо-странице /free (variant=trial).

import { useCallback, useEffect, useRef, useState } from 'react'
import { PhoneInput } from '@/components/phone-input'
import {
  formatKZPhoneFromDigits,
  isKZNumber,
  normalizeToE164Like,
} from '@/lib/kz-phone'
import { trackGoal, setUserId } from '@/lib/analytics-client'
import { useUser } from '@/lib/auth/use-user'
import { DEFAULT_CITY, CITY_COOKIE, isCity } from '@/lib/cities'
import {
  PRICE_KZT,
  formatPriceKzt,
  formatPricePerMonth,
  formatFirstMonthPromoOffer,
} from '@/lib/pricing'
import {
  trackMetaPixelInitiateCheckout,
  trackMetaPixelPurchase,
} from '@/lib/meta-pixel-client'
import {
  buildInitiateCheckoutEventId,
  buildTipTopPurchaseEventId,
} from '@/lib/meta-purchase'
import { readUtmFromCookie } from '@/components/analytics/utm-capture'
import { PwaInstallOnboarding } from '@/components/pwa/pwa-install-onboarding'

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

export type CheckoutUser = { id: string; phone: string } | null
type Step = 'checkout' | 'confirming' | 'success' | 'needs_otp' | 'fail'

type AppliedPromo = {
  code: string
  applies_to: 'first_month' | 'forever'
  first_amount: number
  recurrent_amount: number
}

export type CheckoutFormProps = {
  user: CheckoutUser
  source: string
  /** default — обычный чекаут; trial — промо «первый месяц 1 ₸» (/free). */
  variant?: 'default' | 'trial'
  /** Автоприменить промокод при монтировании (например FREE30 с /free). */
  initialPromoCode?: string | null
  className?: string
}

function readCityFromCookie(): string {
  if (typeof document === 'undefined') return DEFAULT_CITY
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CITY_COOKIE}=`))
  const value = match?.split('=')[1]
  return value && isCity(value) ? value : DEFAULT_CITY
}

function goHome(): void {
  window.location.assign(`/${readCityFromCookie()}`)
}

function goCabinet(): void {
  window.location.assign('/app/me')
}

function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length < 11) return e164
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

export function CheckoutForm({
  user,
  source,
  variant = 'default',
  initialPromoCode = null,
  className,
}: CheckoutFormProps) {
  const { refresh } = useUser()
  const isTrial = variant === 'trial'
  const [step, setStep] = useState<Step>('checkout')
  const [phone, setPhone] = useState(() =>
    user?.phone ? displayPhone(user.phone) : '',
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paidPhone, setPaidPhone] = useState<string | null>(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const phoneFilledRef = useRef(false)
  const widgetOpenedRef = useRef(false)
  const paidRef = useRef(false)
  const externalIdRef = useRef<string | null>(null)
  const existingAccountRef = useRef(false)
  const paidAmountRef = useRef(PRICE_KZT)
  const initialPromoTriedRef = useRef(false)

  const phoneE164 = normalizeToE164Like(phone)
  const phoneValid = Boolean(phoneE164 && isKZNumber(phoneE164))
  const chargeAmount = appliedPromo?.first_amount ?? PRICE_KZT
  const recurrentAmount = appliedPromo?.recurrent_amount ?? PRICE_KZT
  const hasFirstMonthPromo =
    appliedPromo != null &&
    appliedPromo.applies_to === 'first_month' &&
    appliedPromo.first_amount !== appliedPromo.recurrent_amount

  useEffect(() => {
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

    return () => {
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

  const applyPromoCode = useCallback(
    async (codeRaw: string): Promise<boolean> => {
      const code = codeRaw.trim()
      if (!code) {
        setPromoError('Введите промокод.')
        return false
      }
      setPromoBusy(true)
      setPromoError('')
      try {
        const res = await fetch('/api/promo/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          code?: string
          applies_to?: 'first_month' | 'forever'
          first_amount?: number
          recurrent_amount?: number
          message?: string
        }
        if (
          !data.ok ||
          !data.code ||
          data.first_amount == null ||
          data.recurrent_amount == null ||
          !data.applies_to
        ) {
          setAppliedPromo(null)
          setPromoError(data.message ?? 'Промокод недействителен.')
          return false
        }
        setAppliedPromo({
          code: data.code,
          applies_to: data.applies_to,
          first_amount: data.first_amount,
          recurrent_amount: data.recurrent_amount,
        })
        setPromoError('')
        trackGoal('promo_applied', {
          source,
          promo_code: data.code,
          first_amount: data.first_amount,
          applies_to: data.applies_to,
        })
        return true
      } catch {
        setPromoError('Не удалось проверить промокод. Попробуйте ещё раз.')
        return false
      } finally {
        setPromoBusy(false)
      }
    },
    [source],
  )

  useEffect(() => {
    const code = initialPromoCode?.trim()
    if (!code || initialPromoTriedRef.current) return
    initialPromoTriedRef.current = true
    void applyPromoCode(code)
  }, [applyPromoCode, initialPromoCode])

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
              { value: paidAmountRef.current, currency: 'KZT' },
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
              { value: paidAmountRef.current, currency: 'KZT' },
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
    paidRef.current = true
    goHome()
  }, [refresh, source])

  const launchWidget = useCallback(
    async (
      normalizedPhone: string,
      amounts: { first: number; recurrent: number },
      promoCode: string | null,
    ) => {
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
      paidAmountRef.current = amounts.first
      const utm = readUtmFromCookie()
      const metadata = {
        source,
        ...utm,
        ...(promoCode ? { promo_code: promoCode } : {}),
      }

      try {
        const recurrentPayload = {
          period: 1,
          interval: 'Month' as const,
          amount: amounts.recurrent,
        }
        const result = await new tiptop.Widget().start({
          publicTerminalId: process.env.NEXT_PUBLIC_TIPTOPPAY_PUBLIC_ID,
          description: 'Подписка kudaclub — 1 месяц',
          amount: amounts.first,
          currency: 'KZT',
          culture: 'ru-RU',
          paymentSchema: 'Single',
          externalId,
          metadata,
          accountId: normalizedPhone,
          userInfo: {
            accountId: normalizedPhone,
            phone: normalizedPhone,
          },
          data: {
            recurrent: recurrentPayload,
          },
          recurrent: recurrentPayload,
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

  const applyPromo = useCallback(async () => {
    await applyPromoCode(promoInput)
  }, [applyPromoCode, promoInput])

  const clearPromo = useCallback(() => {
    if (isTrial && initialPromoCode) return
    setAppliedPromo(null)
    setPromoInput('')
    setPromoError('')
  }, [initialPromoCode, isTrial])

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
        body: JSON.stringify({
          phone: phoneE164,
          source,
          ...(appliedPromo ? { promo_code: appliedPromo.code } : {}),
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        phone?: string
        existing_account?: boolean
        first_amount?: number
        recurrent_amount?: number
        promo_code?: string | null
        error?: string
        promo_error?: string
      }
      if (!data.ok || !data.phone) {
        if (data.promo_error) {
          setAppliedPromo(null)
          setPromoError(data.error ?? 'Промокод больше не действует.')
          setError('')
          setBusy(false)
          return
        }
        setError(data.error ?? 'Не удалось начать оплату. Попробуйте ещё раз.')
        setBusy(false)
        return
      }
      existingAccountRef.current = Boolean(data.existing_account)
      setPaidPhone(data.phone)
      await launchWidget(
        data.phone,
        {
          first: data.first_amount ?? PRICE_KZT,
          recurrent: data.recurrent_amount ?? PRICE_KZT,
        },
        data.promo_code ?? appliedPromo?.code ?? null,
      )
    } catch {
      setError('Не удалось начать оплату. Проверьте соединение.')
      setBusy(false)
    }
  }, [appliedPromo, launchWidget, phoneE164, phoneValid, source])

  const offerTitle = hasFirstMonthPromo
    ? formatFirstMonthPromoOffer(chargeAmount, recurrentAmount)
    : formatPricePerMonth(chargeAmount)

  const submitLabel = busy
    ? 'Открываем оплату…'
    : `Оплатить ${formatPriceKzt(chargeAmount)}`

  return (
    <div className={className}>
      {step === 'checkout' && (
        <>
          <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
            {offerTitle}
          </h3>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.45] text-neutral-600">
            <li>· Офферы 1+1 в заведениях-партнёрах</li>
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
              autoFocus={!isTrial}
              placeholder="+7 (700) 000-00-00"
              className={inputCls}
            />

            {!isTrial && (
              <>
                {!promoOpen && !appliedPromo ? (
                  <button
                    type="button"
                    onClick={() => setPromoOpen(true)}
                    className="self-start py-1 text-[15px] font-medium text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
                  >
                    Есть промокод?
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-700">
                        <span>
                          Промокод{' '}
                          <span className="font-medium text-neutral-900">
                            {appliedPromo.code}
                          </span>{' '}
                          применён
                        </span>
                        <button
                          type="button"
                          onClick={clearPromo}
                          className="shrink-0 text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
                        >
                          Убрать
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => {
                            setPromoInput(e.target.value)
                            setPromoError('')
                          }}
                          placeholder="Промокод"
                          autoComplete="off"
                          autoCapitalize="characters"
                          className={`${inputCls} flex-1`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void applyPromo()
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={promoBusy || !promoInput.trim()}
                          onClick={() => void applyPromo()}
                          className="shrink-0 rounded-lg border-[0.5px] border-neutral-200 bg-white px-3.5 text-[13px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {promoBusy ? '…' : 'Применить'}
                        </button>
                      </div>
                    )}
                    {promoError ? (
                      <p className="text-[12px] leading-[1.4] text-red-600">
                        {promoError}
                      </p>
                    ) : null}
                    {!appliedPromo ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPromoOpen(false)
                          setPromoInput('')
                          setPromoError('')
                        }}
                        className="self-start text-[12px] text-neutral-400 hover:text-neutral-600"
                      >
                        Скрыть
                      </button>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {isTrial && promoError ? (
              <p className="text-[12px] leading-[1.4] text-red-600">{promoError}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !phoneValid || (isTrial && promoBusy && !appliedPromo)}
              className={primaryBtn}
            >
              {submitLabel}
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
            .
            {hasFirstMonthPromo
              ? ` Списание ${formatPriceKzt(chargeAmount)} сейчас, далее ${formatPriceKzt(recurrentAmount)} ежемесячно, отмена в любой момент в 2 клика.`
              : ` Списание ${formatPriceKzt(chargeAmount)} ежемесячно, отмена в любой момент в 2 клика.`}
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

      {step === 'success' && (
        <>
          <PwaInstallOnboarding onSkip={goCabinet} />
          <h3 className="text-lg font-medium tracking-[-0.2px] text-neutral-900">
            Оплата прошла!
          </h3>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-neutral-500">
            Открываем кабинет…
          </p>
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
  )
}
