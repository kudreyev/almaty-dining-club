import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { buildActivationUrl } from '@/lib/activation-links'
import { createActivationLink } from './actions'

type ActivationLinkListRow = {
  id: string
  token: string
  phone_target: string
  amount: number
  currency: string
  status: string
  created_at: string
  expires_at: string
  activated_at: string | null
}

function waMeDigits(phoneE164: string) {
  return phoneE164.replace(/\D/g, '')
}

function buildManagerWhatsAppHref(phoneTarget: string, publicUrl: string) {
  const text = `Здравствуйте! Вот ссылка для активации подписки KudaPass на 1 месяц: ${publicUrl}\nВажно: войдите с номера ${phoneTarget}`
  const digits = waMeDigits(phoneTarget)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export default async function AdminActivationLinksPage() {
  const { supabase } = await requireAdmin()

  const { data: rows, error } = await supabase
    .from('activation_links')
    .select('id, token, phone_target, amount, currency, status, created_at, expires_at, activated_at')
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<ActivationLinkListRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin · Ссылки активации</h1>
            <p className="mt-2 text-sm text-gray-600">
              Создайте одноразовую ссылку для клиента после оплаты.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/restaurants"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Заведения
            </Link>
            <Link
              href="/admin/payments"
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Оплаты
            </Link>
          </div>
        </div>

        <form action={createActivationLink} className="mt-8 grid gap-4 rounded-2xl border border-gray-200 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="phone_target" className="mb-2 block text-sm font-medium text-gray-700">
              Номер клиента
            </label>
            <input
              id="phone_target"
              name="phone_target"
              type="tel"
              required
              placeholder="+7 700 000 00 00"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
          </div>
          <div>
            <label htmlFor="amount" className="mb-2 block text-sm font-medium text-gray-700">
              Сумма (〒)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              defaultValue={4990}
              min={1}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white md:self-end"
          >
            Создать
          </button>
        </form>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-3 pr-4 font-medium">Телефон</th>
                <th className="py-3 pr-4 font-medium">Сумма</th>
                <th className="py-3 pr-4 font-medium">Статус</th>
                <th className="py-3 pr-4 font-medium">Создана</th>
                <th className="py-3 pr-4 font-medium">Истекает</th>
                <th className="py-3 pr-4 font-medium">Активирована</th>
                <th className="py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows?.length ? (
                rows.map((row) => {
                  const url = buildActivationUrl(row.token)
                  const waHref = buildManagerWhatsAppHref(row.phone_target, url)
                  return (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium">{row.phone_target}</td>
                      <td className="py-3 pr-4">
                        {row.amount} {row.currency}
                      </td>
                      <td className="py-3 pr-4">{row.status}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(row.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(row.expires_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {row.activated_at ? new Date(row.activated_at).toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-2">
                          <code className="max-w-[240px] truncate rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700">
                            {url}
                          </code>
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex w-fit rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-black"
                          >
                            Отправить в WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Пока нет ссылок. Создайте первую выше.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
