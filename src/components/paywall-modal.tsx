'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

const WHATSAPP_SUBSCRIBE_URL =
  'https://wa.me/77066059899?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BF%D0%BE%D0%B4%D0%BF%D0%B8%D1%81%D0%BA%D1%83%20KudaPass%20%D0%BD%D0%B0%20%D0%BE%D0%B4%D0%B8%D0%BD%20%D0%BC%D0%B5%D1%81%D1%8F%D1%86'

type PaywallModalProps = {
  onClose: () => void
}

export function PaywallModal({ onClose }: PaywallModalProps) {
  const [mounted, setMounted] = useState(false)
  const portalRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    portalRef.current = document.body
    setMounted(true)

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted || !portalRef.current) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="paywall-title" className="text-lg font-bold leading-snug">
          Нужна подписка KudaPass
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Оформите подписку — и получите доступ ко всем заведениям.
        </p>

        {/* Bullets */}
        <ul className="mt-5 space-y-2.5">
          {[
            'Доступ ко всем предложениям в Алматы',
            'Активация занимает 5 минут через WhatsApp',
            'Использование: 1 раз в 7 дней на заведение',
          ].map((text) => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-gray-700">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {text}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="mt-7 flex flex-col gap-2.5">
          <a
            href={WHATSAPP_SUBSCRIBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
          >
            Оформить в WhatsApp
          </a>
          <Link
            href="/pricing"
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-2xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Подробнее о подписке
          </Link>
        </div>
      </div>
    </div>,
    portalRef.current,
  )
}
