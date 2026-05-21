import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type SubscriptionRow = {
  id: string
  status: 'inactive' | 'pending_payment' | 'active' | 'expired'
  plan_name: string
  plan_type: 'paid' | 'trial'
  start_date: string | null
  end_date: string | null
}

export async function getCurrentUserSubscription() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null as User | null,
      subscription: null as SubscriptionRow | null,
    }
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, plan_name, plan_type, start_date, end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<SubscriptionRow[]>()

  const subscription = subscriptions?.[0] ?? null

  return {
    user,
    subscription,
  }
}

export function isSubscriptionCurrentlyActive(subscription: {
  status: string
  start_date: string | null
  end_date: string | null
} | null) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false
  if (!subscription.start_date || !subscription.end_date) return false

  const today = new Date()
  const todayString = today.toISOString().slice(0, 10)

  return subscription.start_date <= todayString && subscription.end_date >= todayString
}

export type HomeUserState =
  | { kind: 'guest'; user: null; subscription: null }
  | { kind: 'no_sub'; user: User; subscription: null }
  | {
      kind: 'paid'
      user: User
      subscription: SubscriptionRow
      endDate: string
    }
  | {
      kind: 'trial'
      user: User
      subscription: SubscriptionRow
      endDate: string
      daysLeft: number
    }

function diffDays(endDateIso: string): number {
  // end_date — это date в БД, его сравнение с «сегодня» (UTC) даёт стабильное число дней.
  const today = new Date()
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  )
  const [yStr, mStr, dStr] = endDateIso.split('-')
  const end = Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr))
  const diff = Math.ceil((end - todayUtc) / (24 * 60 * 60 * 1000))
  return Math.max(0, diff)
}

export async function getHomePageUserState(): Promise<HomeUserState> {
  const { user, subscription } = await getCurrentUserSubscription()

  if (!user) {
    return { kind: 'guest', user: null, subscription: null }
  }

  if (!isSubscriptionCurrentlyActive(subscription) || !subscription) {
    return { kind: 'no_sub', user, subscription: null }
  }

  const endDate = subscription.end_date as string

  if (subscription.plan_type === 'trial') {
    return {
      kind: 'trial',
      user,
      subscription,
      endDate,
      daysLeft: diffDays(endDate),
    }
  }

  return {
    kind: 'paid',
    user,
    subscription,
    endDate,
  }
}

const DEFAULT_REDEMPTION_VALUE_KZT = 2500

export type UserSavings = {
  amountKzt: number
  redemptionsCount: number
  hasRedemptions: boolean
}

type RedemptionWithOffer = {
  offers: { estimated_value: number | null } | null
}

export async function getUserSavings(userId: string): Promise<UserSavings> {
  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from('redemptions')
    .select('offers ( estimated_value )')
    .eq('user_id', userId)
    .returns<RedemptionWithOffer[]>()

  const rows = data ?? []
  let total = 0
  for (const row of rows) {
    const value = row.offers?.estimated_value
    total += typeof value === 'number' && value > 0 ? value : DEFAULT_REDEMPTION_VALUE_KZT
  }

  return {
    amountKzt: total,
    redemptionsCount: rows.length,
    hasRedemptions: rows.length > 0,
  }
}
