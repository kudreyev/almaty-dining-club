'use client'

// Модальная оболочка над CheckoutForm: портал, backdrop, Escape, overflow.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  CheckoutForm,
  type CheckoutUser,
} from '@/components/checkout/checkout-form'

export default function CheckoutModal({
  user,
  source,
  onClose,
  initialPromoCode,
}: {
  user: CheckoutUser
  source: string
  onClose: () => void
  initialPromoCode?: string | null
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

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

        <CheckoutForm
          user={user}
          source={source}
          initialPromoCode={initialPromoCode}
        />
      </div>
    </div>,
    document.body,
  )
}
