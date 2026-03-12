import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getCurrentUserSubscription() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      subscription: null,
    }
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, plan_name, start_date, end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

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