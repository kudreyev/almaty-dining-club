import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PaymentRequestForm } from '@/components/payment-request-form'

export default async function PaymentSubmitPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Подтверждение оплаты</h1>
        <p className="mt-3 text-gray-600">
          После оплаты через Kaspi отправьте заявку ниже. Мы проверим её и активируем подписку.
        </p>

        <div className="mt-8">
          <PaymentRequestForm userId={user.id} />
        </div>
      </div>
    </main>
  )
}