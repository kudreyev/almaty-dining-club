import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { completeChat } from '@/lib/llm'
import { KUDACLUB_WHATSAPP_PHONE } from '@/lib/whatsapp'
import { findUserByPhone } from '@/lib/user-by-phone'
import { isSubscriptionCurrentlyActive } from '@/lib/subscription'

export type CopilotIntent = 'subscribe' | 'renew' | 'support' | 'unknown'

export type CopilotContext = {
  phone_e164: string
  is_registered: boolean
  has_active_subscription: boolean
  subscription_status: string | null
  subscription_end_date: string | null
  total_subscriptions: number
  redemptions_count: number
  recent_restaurants: string[]
  trial_used: boolean | null
}

export type CopilotDraft = {
  intent: CopilotIntent
  draft_text: string
  context: CopilotContext
  generated_at: string
  source: 'llm' | 'template'
}

const MONTHLY_PRICE = 1990

function formatKaspiLine(): string {
  const d = KUDACLUB_WHATSAPP_PHONE.replace(/\D/g, '')
  const local = d.startsWith('7') && d.length === 11 ? d.slice(1) : d
  if (local.length === 10) {
    return `Kaspi: +7 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  }
  return `Kaspi: +${d}`
}

export function classifyIntent(text: string): CopilotIntent {
  const lower = text.toLowerCase()
  if (/продл|истек|закончил|renew/.test(lower)) return 'renew'
  if (/помощ|ошибк|активац|не работ|support|help/.test(lower)) return 'support'
  if (/подписк|оформ|1990|kaspi|оплат|trial|проб/.test(lower)) return 'subscribe'
  if (/интересует|хочу попробовать|kudaclub/.test(lower)) return 'subscribe'
  return 'unknown'
}

export async function loadCopilotContext(phoneE164: string): Promise<CopilotContext> {
  const admin = createSupabaseAdminClient()
  const user = await findUserByPhone(phoneE164)

  if (!user) {
    return {
      phone_e164: phoneE164,
      is_registered: false,
      has_active_subscription: false,
      subscription_status: null,
      subscription_end_date: null,
      total_subscriptions: 0,
      redemptions_count: 0,
      recent_restaurants: [],
      trial_used: null,
    }
  }

  const [profileRes, subsRes, redemptionsRes] = await Promise.all([
    admin.from('profiles').select('trial_used').eq('id', user.userId).maybeSingle(),
    admin
      .from('subscriptions')
      .select('status, end_date, created_at, start_date')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false }),
    admin
      .from('redemptions')
      .select('restaurant_id, redeemed_at')
      .eq('user_id', user.userId)
      .order('redeemed_at', { ascending: false })
      .limit(10),
  ])

  const subs = subsRes.data ?? []
  const latest = subs[0] ?? null
  const active = isSubscriptionCurrentlyActive(latest)

  const restaurantIds = [...new Set((redemptionsRes.data ?? []).map((r) => r.restaurant_id))]
  let recentRestaurants: string[] = []
  if (restaurantIds.length > 0) {
    const { data: restaurants } = await admin
      .from('restaurants')
      .select('restaurant_name')
      .in('id', restaurantIds.slice(0, 5))
    recentRestaurants = (restaurants ?? []).map((r) => r.restaurant_name)
  }

  return {
    phone_e164: phoneE164,
    is_registered: true,
    has_active_subscription: active,
    subscription_status: latest?.status ?? null,
    subscription_end_date: latest?.end_date ?? null,
    total_subscriptions: subs.length,
    redemptions_count: redemptionsRes.data?.length ?? 0,
    recent_restaurants: recentRestaurants,
    trial_used: profileRes.data?.trial_used ?? null,
  }
}

export function buildTemplateDraft(
  intent: CopilotIntent,
  ctx: CopilotContext,
  inboundText: string,
): string {
  const kaspi = formatKaspiLine()

  if (intent === 'support') {
    return `Здравствуйте! Помогу с активацией подписки Kudaclub.\n\nОпишите, пожалуйста, что именно не получилось (ссылка, оплата, вход в аккаунт)?`
  }

  if (intent === 'renew' && ctx.has_active_subscription) {
    return `Здравствуйте! Вижу, у вас уже активная подписка до ${ctx.subscription_end_date ?? '—'}. Нужна помощь с продлением заранее?`
  }

  if (intent === 'renew') {
    return `Здравствуйте! Продлим подписку Kudaclub — ${MONTHLY_PRICE} ₸ за 30 дней.\n\nПеревод на ${kaspi}\n\nПосле оплаты пришлю активационную ссылку.`
  }

  if (ctx.has_active_subscription) {
    return `Здравствуйте! У вас уже активная подписка Kudaclub${ctx.subscription_end_date ? ` до ${ctx.subscription_end_date}` : ''}. Чем могу помочь?`
  }

  if (/хочу попробовать/i.test(inboundText)) {
    const restaurant = inboundText.match(/попробовать\s+(.+)/i)?.[1]?.trim()
    const venueLine = restaurant ? `\n\nОтличный выбор — ${restaurant}!` : ''
    return `Здравствуйте! Оформим подписку Kudaclub за 5 минут.${venueLine}\n\nСтоимость: ${MONTHLY_PRICE} ₸ за 30 дней, окупается с первого визита.\n\nПеревод: ${kaspi}\n\nПосле оплаты пришлю активационную ссылку.`
  }

  if (intent === 'subscribe' || /оформ/i.test(inboundText)) {
    return `Здравствуйте! Оформим подписку Kudaclub — ${MONTHLY_PRICE} ₸/мес, скидки в 30+ ресторанах Алматы.\n\nПеревод: ${kaspi}\n\nПосле оплаты пришлю активационную ссылку.`
  }

  return `Здравствуйте! Kudaclub — подписка на скидки в ресторанах Алматы (${MONTHLY_PRICE} ₸/мес).\n\nРасскажите, что вас интересует — оформление подписки, продление или помощь с активацией?`
}

function buildCopilotPrompt(inboundText: string, ctx: CopilotContext, intent: CopilotIntent): string {
  return `Ты — ассистент оператора Kudaclub (подписка на рестораны Алматы, ${MONTHLY_PRICE} ₸/мес).

Входящее сообщение клиента:
"${inboundText}"

Контекст из БД (JSON):
${JSON.stringify({ intent, ...ctx }, null, 2)}

Напиши готовый ответ для оператора (копи-паст в WhatsApp):
- по-русски, дружелюбно, без markdown
- если новый лид — ${formatKaspiLine()}
- не выдумывай факты о клиенте — только из контекста
- 3–6 коротких предложений`
}

export async function generateCopilotDraft(args: {
  inboundText: string
  phoneE164: string
}): Promise<CopilotDraft> {
  const ctx = await loadCopilotContext(args.phoneE164)
  const intent = classifyIntent(args.inboundText)

  const prompt = buildCopilotPrompt(args.inboundText, ctx, intent)
  const llmText = await completeChat(prompt)

  const draftText = llmText ?? buildTemplateDraft(intent, ctx, args.inboundText)

  return {
    intent,
    draft_text: draftText,
    context: ctx,
    generated_at: new Date().toISOString(),
    source: llmText ? 'llm' : 'template',
  }
}

export function formatContextSummary(ctx: CopilotContext): string {
  if (!ctx.is_registered) return 'Новый номер — не зарегистрирован в приложении'
  if (ctx.has_active_subscription) {
    return `Активная подписка до ${ctx.subscription_end_date ?? '—'}, использований: ${ctx.redemptions_count}`
  }
  if (ctx.total_subscriptions > 0) {
    return `Был клиент (${ctx.total_subscriptions} подп.), сейчас не активен`
  }
  return 'Зарегистрирован, подписок не было'
}
