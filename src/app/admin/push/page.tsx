import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { PushAdminClient } from './push-admin-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Пуши — Kudaclub Admin',
  robots: { index: false, follow: false },
}

type CampaignRow = {
  id: string
  title: string
  body: string
  url: string
  segment: 'all' | 'self'
  sent_count: number
  failed_count: number
  click_count: number
  created_at: string
}

type RetentionRow = {
  installed: boolean
  guests: number
  with_1plus: number
  with_2plus: number
}

function share(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—'
}

/** Главная метрика PWA: доля гостей с 2+ погашениями среди установивших и остальных. */
function PwaRetentionCard({ rows }: { rows: RetentionRow[] }) {
  const pick = (installed: boolean) =>
    rows.find((r) => r.installed === installed) ?? { installed, guests: 0, with_1plus: 0, with_2plus: 0 }
  const items = [
    { label: 'Установили приложение', row: pick(true) },
    { label: 'Остальные гости', row: pick(false) },
  ]
  return (
    <section className="mt-6 rounded-xl border border-neutral-200 p-4">
      <h2 className="text-sm font-semibold text-neutral-800">Повторные погашения: PWA и остальные</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map(({ label, row }) => (
          <div key={label} className="rounded-lg bg-neutral-50 px-3 py-2.5 text-[13px]">
            <p className="text-neutral-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">
              {share(row.with_2plus, row.guests)}
            </p>
            <p className="text-neutral-500">
              2+ погашения: {row.with_2plus} из {row.guests} · 1+: {row.with_1plus}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function AdminPushPage() {
  await requireAdmin('/admin/push')
  const db = createSupabaseAdminClient()

  const [{ data }, { data: retention }] = await Promise.all([
    db
    .from('push_campaigns')
    .select(
      'id, title, body, url, segment, sent_count, failed_count, click_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<CampaignRow[]>(),
    db.rpc('pwa_retention_stats'),
  ])

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Web Push</h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        Рассылка подписчикам с включёнными уведомлениями. Сначала тест себе —
        потом всем.
      </p>
      <PwaRetentionCard rows={(retention ?? []) as RetentionRow[]} />
      <div className="mt-8">
        <PushAdminClient initialCampaigns={data ?? []} />
      </div>
    </main>
  )
}
