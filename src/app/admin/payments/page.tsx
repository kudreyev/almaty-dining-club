import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { approvePaymentRequest, rejectPaymentRequest } from './actions'
import { paymentStatusLabel } from '@/lib/labels'

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

export default async function AdminPaymentsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile || profile.role !== 'admin') {
    redirect('/app/me')
  }

  const { data: paymentRequests, error } = await supabase
    .from('payment_requests')
    .select('id, user_id, payment_code, amount, status, comment_from_user, submitted_at, reviewed_at, admin_comment')
    .order('submitted_at', { ascending: false })
    .returns<PaymentRequest[]>()

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Admin Payments</h1>
        <p className="mt-4 text-red-600">Ошибка: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Admin Payments</h1>
        <p className="mt-3 text-gray-600">
          Просмотр и подтверждение заявок на оплату.
        </p>

        <div className="mt-8 space-y-4">
          {!paymentRequests || paymentRequests.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              Заявок пока нет.
            </div>
          ) : (
            paymentRequests.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Payment code</p>
                      <p className="font-medium">{item.payment_code}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">User ID</p>
                      <p className="break-all text-sm font-medium">{item.user_id}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className="font-medium">{item.amount} ₸</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Submitted</p>
                      <p className="font-medium">
                        {new Date(item.submitted_at).toLocaleString('ru-RU')}
                      </p>
                    </div>

                    {item.comment_from_user ? (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-sm text-gray-500">Комментарий</p>
                        <p className="mt-1 text-sm text-gray-700">{item.comment_from_user}</p>
                      </div>
                    ) : null}

                    {item.admin_comment ? (
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-sm text-gray-500">Admin comment</p>
                        <p className="mt-1 text-sm text-gray-700">{item.admin_comment}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-[180px]">
                    <div className="mb-4">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {paymentStatusLabel(item.status)}
                      </span>
                    </div>

                    {item.status === 'pending' ? (
                      <div className="space-y-3">
                        <form action={approvePaymentRequest}>
                          <input type="hidden" name="paymentRequestId" value={item.id} />
                          <input type="hidden" name="userId" value={item.user_id} />
                          <input type="hidden" name="amount" value={item.amount} />
                          <button
                            type="submit"
                            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
                          >
                            Approve
                          </button>
                        </form>

                        <form action={rejectPaymentRequest}>
                          <input type="hidden" name="paymentRequestId" value={item.id} />
                          <button
                            type="submit"
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-black"
                          >
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Уже обработано
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}