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

export default async function AdminPushPage() {
  await requireAdmin('/admin/push')
  const db = createSupabaseAdminClient()

  const { data } = await db
    .from('push_campaigns')
    .select(
      'id, title, body, url, segment, sent_count, failed_count, click_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<CampaignRow[]>()

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Web Push</h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        Рассылка подписчикам с включёнными уведомлениями. Сначала тест себе —
        потом всем.
      </p>
      <div className="mt-8">
        <PushAdminClient initialCampaigns={data ?? []} />
      </div>
    </main>
  )
}
