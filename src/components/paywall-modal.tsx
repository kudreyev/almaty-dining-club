'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { KUDACLUB_SUBSCRIBE_WHATSAPP_URL } from '@/lib/whatsapp'
import { META_SUBSCRIPTION_PRICE_KZT, trackMetaPixel } from '@/lib/meta-pixel-client'

const WHATSAPP_SUBSCRIBE_URL = KUDACLUB_SUBSCRIBE_WHATSAPP_URL

const BULLETS = [
  'Доступ ко всем предложениям в Алматы',
  'Активация занимает 5 минут через WhatsApp',
  'Использование: 1 раз в 7 дней на заведение',
]

type PaywallModalProps = {
  onClose: () => void
}

export function PaywallModal({ onClose }: PaywallModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
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

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm bg-white shadow-2xl"
        style={{ borderRadius: '12px', padding: '24px' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute flex items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          style={{ top: '12px', right: '12px', height: '32px', width: '32px' }}
        >
          <X size={16} strokeWidth={1.8} />
        </button>

        <h2
          id="paywall-title"
          className="font-medium text-neutral-900"
          style={{ fontSize: '18px', lineHeight: 1.3, letterSpacing: '-0.2px' }}
        >
          Нужна подписка Kudaclub
        </h2>

        <p
          className="text-neutral-500"
          style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '6px' }}
        >
          Оформите подписку — и получите доступ ко всем заведениям.
        </p>

        {/* Bullets */}
        <ul
          className="flex list-none flex-col"
          style={{ marginTop: '20px', gap: '10px' }}
        >
          {BULLETS.map((text) => (
            <li
              key={text}
              className="flex items-start text-neutral-700"
              style={{ fontSize: '13px', lineHeight: 1.5, gap: '10px' }}
            >
              <Check
                size={14}
                strokeWidth={2}
                style={{ color: '#a3a3a3', marginTop: '3px', flexShrink: 0 }}
                aria-hidden="true"
              />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex flex-col" style={{ marginTop: '24px', gap: '8px' }}>
          <a
            href={WHATSAPP_SUBSCRIBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackMetaPixel('InitiateCheckout', {
                value: META_SUBSCRIPTION_PRICE_KZT,
                currency: 'KZT',
              })
            }
            className="flex w-full items-center justify-center font-medium text-white transition-opacity hover:opacity-95"
            style={{
              background: '#D85A30',
              borderRadius: '8px',
              padding: '11px 20px',
              fontSize: '14px',
            }}
          >
            Оформить в WhatsApp
          </a>
          <Link
            href="/pricing"
            onClick={onClose}
            className="flex w-full items-center justify-center bg-white font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            style={{
              borderWidth: '0.5px',
              borderStyle: 'solid',
              borderColor: 'rgb(229 229 229)',
              borderRadius: '8px',
              padding: '11px 20px',
              fontSize: '14px',
            }}
          >
            Подробнее о подписке
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}
