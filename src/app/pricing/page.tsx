import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: subs } = user
    ? await supabase
        .from('subscriptions')
        .select('id, status, start_date, end_date')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: null }

  const hasActive = !!subs?.[0]

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold">Подписка для Алматы</h1>
          <p className="mt-3 text-gray-600">
            Открой доступ ко всем офферам партнёров: 1+1 и комплиментам в ресторанах города.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-3xl bg-gray-50 p-6">
            <p className="text-sm text-gray-500">План</p>
            <h2 className="mt-2 text-3xl font-semibold">Monthly Almaty</h2>
            <p className="mt-2 text-lg text-gray-700">4 990 ₸ / 30 дней</p>

            <ul className="mt-6 space-y-3 text-sm text-gray-700">
              <li>— Доступ ко всем активным офферам в Алматы</li>
              <li>— Форматы: 1+1 и комплименты</li>
              <li>— Использование через одноразовый код</li>
              <li>— Проверка оффера через staff panel</li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">
              После активации подписки вы сможете открывать офферы и получать одноразовый код для использования в ресторане.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold">Как оплатить через Kaspi</h3>

            <ol className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
              <li>1. Оплатите подписку на сумму <strong>4 990 ₸</strong></li>
              <li>2. В комментарии к оплате укажите ваш email</li>
              <li>3. После оплаты отправьте заявку через форму ниже</li>
              <li>4. Мы подтвердим оплату и активируем подписку</li>
            </ol>

            <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Реквизиты для оплаты</p>
              <p className="mt-2">Kaspi: +7 777 000 00 00</p>
              <p className="mt-1">Получатель: Dining Club Almaty</p>
            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">После оплаты</p>
              <p className="mt-2">
                Отправь заявку “Я оплатил” — мы подтвердим оплату и активируем подписку.
              </p>
              <p className="mt-2 text-gray-600">
                Обычно подтверждаем в течение{' '}
                <span className="font-medium text-gray-900">1–3 часов</span> (в рабочее время).
              </p>
            </div>

            <div className="mt-6">
              {user ? (
                hasActive ? (
                  <Link
                    href="/almaty"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                  >
                    Подписка активна — смотреть офферы
                  </Link>
                ) : (
                  <Link
                    href="/payment/submit"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                  >
                    Я оплатил
                  </Link>
                )
              ) : (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-medium text-white"
                >
                  Войти, чтобы отправить оплату
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}