'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function generatePaymentCode() {
  return `KP-${Math.floor(100000 + Math.random() * 900000)}`
}

export function PaymentRequestForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [amount, setAmount] = useState('4990')
  const [comment, setComment] = useState('')
  const [paymentCode] = useState(generatePaymentCode())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase.from('payment_requests').insert({
      user_id: userId,
      payment_code: paymentCode,
      amount: Number(amount),
      status: 'pending',
      comment_from_user: comment || null,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/app/me?payment=submitted')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Ваш код платежа</p>
        <p className="mt-1 text-lg font-semibold">{paymentCode}</p>
        <p className="mt-2 text-xs text-gray-500">
          Укажите этот код или свою почту в комментарии к оплате, если это возможно.
        </p>
      </div>

      <div>
        <label htmlFor="amount" className="mb-2 block text-sm font-medium text-gray-700">
          Сумма
        </label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
        />
      </div>

      <div>
        <label htmlFor="comment" className="mb-2 block text-sm font-medium text-gray-700">
          Комментарий
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например: оплатил с Kaspi, время 14:32"
          rows={4}
          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Отправка...' : 'Отправить заявку'}
      </button>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
    </form>
  )
}