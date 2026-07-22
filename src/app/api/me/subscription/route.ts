// src/app/api/me/subscription/route.ts
// Лёгкий эндпоинт для клиентского useUser(): кто залогинен + есть ли активная
// подписка. Используется компонентом SubscribeCTA, чтобы решить, показывать
// кнопку покупки, «Подписка активна ✓» или запускать чекаут.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSubscriptionCurrentlyActive } from '@/lib/subscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SubRow = {
  status: string
  start_date: string | null
  end_date: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ user: null })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle<{ phone: string | null }>()

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status, start_date, end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<SubRow[]>()

  const active = isSubscriptionCurrentlyActive(subscriptions?.[0] ?? null)

  const phoneFromMetadata =
    typeof user.user_metadata?.phone_e164 === 'string'
      ? user.user_metadata.phone_e164
      : null

  return NextResponse.json({
    user: {
      id: user.id,
      phone: profile?.phone ?? phoneFromMetadata ?? '',
      subscriptionStatus: active ? 'active' : null,
    },
  })
}
