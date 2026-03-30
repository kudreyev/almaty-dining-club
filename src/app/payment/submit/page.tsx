import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PaymentRequestForm } from '@/components/payment-request-form'
import { Card } from '@/components/ui/card'

export default async function PaymentSubmitPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <Card padding="lg">
        <h1 className="text-xl font-bold">Подтверждение оплаты</h1>
        <p className="mt-2 text-sm text-gray-500">
          После оплаты через Kaspi отправьте заявку. Мы проверим и активируем подписку.
        </p>
        <div className="mt-6">
          <PaymentRequestForm userId={user.id} />
        </div>
      </Card>
    </div>
  )
}
