import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { userKindLabel, type UserKind } from '@/lib/user-kind'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkStaffForm } from './mark-staff-form'
import { formatPhoneForDisplay } from '@/lib/kz-phone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProfileRow = {
  id: string
  phone: string | null
  email: string | null
  role: 'user' | 'admin'
  user_kind: UserKind
  trial_used: boolean
  created_at: string
}

type PageProps = {
  searchParams: Promise<{ showInternal?: string }>
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { showInternal } = await searchParams
  const showStaffTest = showInternal === '1'

  const admin = createSupabaseAdminClient()
  let query = admin
    .from('profiles')
    .select('id, phone, email, role, user_kind, trial_used, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!showStaffTest) {
    query = query.eq('user_kind', 'customer')
  }

  const { data: profiles, error } = await query.returns<ProfileRow[]>()

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Пользователи</h1>
          <p className="mt-1 text-base leading-6 text-gray-500">
            {showStaffTest
              ? 'Все профили, включая стафф и тест.'
              : 'Только клиенты (customer). Стафф и тест скрыты из метрик.'}
          </p>
        </div>
        <Link
          href={showStaffTest ? '/admin/users' : '/admin/users?showInternal=1'}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showStaffTest ? 'Только клиенты' : 'Показать стафф/тест'}
        </Link>
      </div>

      <Card className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Отметить стаффом по телефону</h2>
        <MarkStaffForm />
        <p className="mt-2 text-xs text-gray-400">
          Создаёт/обновляет подписку plan_type=staff до 2099-12-31 и помечает trial-подписки
          неактивными.
        </p>
      </Card>

      <Card padding="none" className="overflow-hidden">
        {error ? (
          <p className="px-4 py-6 text-center text-red-600">{error.message}</p>
        ) : (profiles ?? []).length === 0 ? (
          <p className="px-4 py-6 text-center text-gray-500">Нет профилей.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-base">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Телефон</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Тип</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Роль</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Trial</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(profiles ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {row.phone ? formatPhoneForDisplay(row.phone) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        color={
                          row.user_kind === 'staff'
                            ? 'dark'
                            : row.user_kind === 'test'
                              ? 'yellow'
                              : 'green'
                        }
                      >
                        {userKindLabel(row.user_kind)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.role}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.trial_used ? 'да' : 'нет'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
