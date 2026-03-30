import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { approvePaymentRequest, rejectPaymentRequest } from './actions'
import { paymentStatusLabel } from '@/lib/labels'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

type PaymentRequest = {
  id: string
  user_id: string
  payment_code: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  comment_from_user: string | null
  submitted_at: string
  reviewed_at: string | null
  admin_comment: string | null
}

type Profile = {
  id: string
  email: string | null
  role: 'user' | 'admin'
}

function statusColor(s: string): 'yellow' | 'green' | 'red' | 'default' {
  if (s === 'pending') return 'yellow'
  if (s === 'approved') return 'green'
  if (s === 'rejected') return 'red'
  return 'default'
}

export default async function AdminPaymentsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || profile.role !== 'admin') redirect('/app/me')

  const { data: paymentRequests, error } = await supabase
    .from('payment_requests')
    .select('id, user_id, payment_code, amount, status, comment_from_user, submitted_at, reviewed_at, admin_comment')
    .order('submitted_at', { ascending: false })
    .returns<PaymentRequest[]>()

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-xl font-bold">Заявки на оплату</h1>
        <p className="mt-4 text-sm text-red-600">Ошибка: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Заявки на оплату</h1>
        <p className="mt-1 text-sm text-gray-500">Просмотр и подтверждение заявок.</p>
      </div>

      {!paymentRequests || paymentRequests.length === 0 ? (
        <EmptyState title="Заявок пока нет" description="Новые заявки появятся здесь" />
      ) : (
        <div className="space-y-4">
          {paymentRequests.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.payment_code}</span>
                    <Badge color={statusColor(item.status)}>
                      {paymentStatusLabel(item.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-600">
                    <p>Сумма: <span className="font-medium text-gray-900">{item.amount} ₸</span></p>
                    <p>Отправлено: {new Date(item.submitted_at).toLocaleString('ru-RU')}</p>
                  </div>

                  <p className="text-xs text-gray-400 break-all">ID: {item.user_id}</p>

                  {item.comment_from_user ? (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                      {item.comment_from_user}
                    </div>
                  ) : null}

                  {item.admin_comment ? (
                    <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                      Админ: {item.admin_comment}
                    </div>
                  ) : null}
                </div>

                {item.status === 'pending' ? (
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <form action={approvePaymentRequest}>
                      <input type="hidden" name="paymentRequestId" value={item.id} />
                      <input type="hidden" name="userId" value={item.user_id} />
                      <input type="hidden" name="amount" value={item.amount} />
                      <Button type="submit" size="sm" className="w-full">
                        Подтвердить
                      </Button>
                    </form>
                    <form action={rejectPaymentRequest}>
                      <input type="hidden" name="paymentRequestId" value={item.id} />
                      <Button type="submit" variant="secondary" size="sm" className="w-full">
                        Отклонить
                      </Button>
                    </form>
                  </div>
                ) : (
                  <p className="shrink-0 text-xs text-gray-400">Обработано</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
