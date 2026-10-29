'use client'

import { CheckoutForm } from '@/components/checkout/checkout-form'
import { useUser } from '@/lib/auth/use-user'
import { SUBSCRIPTIONS_CLOSED_MESSAGE, SUBSCRIPTIONS_OPEN } from '@/lib/pricing'

type FreeCheckoutProps = {
  source: string
  promoCode: string | null
}

/** Инлайн-чекаут на /free: первый месяц 30 ₸ (телефон + кнопка + согласие). */
export function FreeCheckout({ source, promoCode }: FreeCheckoutProps) {
  const { user } = useUser()

  if (!SUBSCRIPTIONS_OPEN) {
    return (
      <p
        role="status"
        className="rounded-xl border-[0.5px] border-neutral-200 bg-white p-5 text-center text-sm text-neutral-600 shadow-sm"
      >
        {SUBSCRIPTIONS_CLOSED_MESSAGE}
      </p>
    )
  }

  return (
    <CheckoutForm
      user={user ? { id: user.id, phone: user.phone } : null}
      source={source}
      variant="trial"
      initialPromoCode={promoCode}
      className="rounded-xl border-[0.5px] border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    />
  )
}
