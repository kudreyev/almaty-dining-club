'use client'
// src/components/SubscribeButton.tsx
// Кнопка «Оформить подписку»: открывает виджет TipTop Pay.
// Первый платёж пользователь оплачивает картой, дальше TipTop Pay сам
// списывает 1 990 ₸ ежемесячно (объект recurrent) — свой биллинг не нужен.
//
// Доступ к подписке НИКОГДА не открывается по коллбэку виджета на фронте —
// только серверным Pay-вебхуком (/api/tiptoppay/pay). Здесь мы лишь
// показываем пользователю статус оплаты.

import { useCallback, useEffect, useState } from 'react'

declare global {
  interface Window {
    tiptop?: { Widget: new () => { start: (p: object) => Promise<{ status?: string }> } }
  }
}

const WIDGET_SRC = 'https://widget.tiptoppay.kz/bundles/widget.js'

type Props = {
  userId: string // ID пользователя в нашей БД — обязателен для подписки
  email: string // email для квитанций
  amount?: number // цена подписки, ₸/мес
  className?: string
}

export default function SubscribeButton({
  userId,
  email,
  amount = 1990,
  className = '',
}: Props) {
  const [ready, setReady] = useState<boolean>(
    () => typeof window !== 'undefined' && !!window.tiptop
  )
  const [status, setStatus] = useState<'idle' | 'paying' | 'success' | 'fail'>('idle')

  useEffect(() => {
    if (typeof window === 'undefined' || window.tiptop) return
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SRC}"]`
    )
    if (existing) {
      existing.addEventListener('load', () => setReady(true))
      return
    }
    const s = document.createElement('script')
    s.src = WIDGET_SRC
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])

  const pay = useCallback(() => {
    if (!window.tiptop) return
    setStatus('paying')
    const widget = new window.tiptop.Widget()
    widget
      .start({
        publicTerminalId: process.env.NEXT_PUBLIC_TIPTOPPAY_PUBLIC_ID, // Public ID терминала
        description: 'Подписка Kudaclub — 1 месяц',
        amount, // установочный платёж (первый месяц)
        currency: 'KZT',
        culture: 'ru-RU',
        paymentSchema: 'Single', // одностадийная оплата
        externalId: `sub_${userId}_${Date.now()}`, // наш ID платежа, придёт в вебхуке
        userInfo: {
          accountId: userId, // ОБЯЗАТЕЛЬНО для рекуррента
          email,
        },
        recurrent: {
          period: 1,
          interval: 'Month', // списание раз в месяц
          amount, // сумма регулярных списаний
          // startDate не указываем — первое списание через месяц после оплаты
        },
      })
      .then((result) => {
        // Финальный статус пользователю показать можно, но доступ открывается
        // ТОЛЬКО по Pay-вебхуку на сервере — фронту доверять нельзя.
        setStatus(result?.status === 'success' ? 'success' : 'fail')
      })
      .catch(() => setStatus('fail'))
  }, [userId, email, amount])

  if (status === 'success') {
    return (
      <p className="rounded-md bg-success-light px-4 py-3 text-center text-[13px] font-medium text-success-dark">
        Оплата прошла! Подписка активируется в течение минуты.
      </p>
    )
  }

  const defaultClassName =
    'block w-full rounded-md bg-primary px-5 py-[13px] text-center text-[15px] font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <>
      <button
        type="button"
        onClick={pay}
        disabled={!ready || status === 'paying'}
        className={className || defaultClassName}
      >
        {status === 'paying'
          ? 'Открываем оплату…'
          : `Оформить подписку — ${amount.toLocaleString('ru-RU')} ₸/мес`}
      </button>
      {status === 'fail' ? (
        <p className="mt-2 text-center text-[12px] text-red-600">
          Оплата не прошла. Попробуйте ещё раз или напишите нам.
        </p>
      ) : null}
    </>
  )
}
