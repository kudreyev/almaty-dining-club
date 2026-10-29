// Одноразовая страховка: найти и отменить все активные рекуррентные подписки в TipTop Pay.
//
// Доступ: только сервисный ключ (Authorization: Bearer <service_role>) или JWT
// пользователя с profiles.role = 'admin'.
// Секреты (Supabase → Edge Functions → Secrets): TIPTOP_PUBLIC_ID, TIPTOP_API_SECRET.
// По умолчанию dry-run (только список). Реальная отмена — только с dry_run=false.
//
// Вызов (повторять с next_offset, пока он не станет null; run_id передавать тот же):
//   POST /functions/v1/cancel-all-subscriptions?dry_run=true&offset=0&limit=150

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const TIPTOP_API = 'https://api.tiptoppay.kz'
const CANCELLABLE = new Set(['active', 'pastdue'])
const DEFAULT_LIMIT = 150
const MAX_LIMIT = 500
const CONCURRENCY = 4

type Target =
  | { kind: 'account'; accountId: string; userId: string | null }
  | { kind: 'subscription'; subscriptionId: string; userId: string | null }

type TipTopSubscription = {
  Id: string
  AccountId?: string | null
  Status?: string | null
  Amount?: number | null
  Currency?: string | null
  NextTransactionDateIso?: string | null
}

type TipTopResponse<T> = { Success?: boolean; Message?: string | null; Model?: T }

type LogRow = {
  run_id: string
  dry_run: boolean
  tiptop_subscription_id: string | null
  user_id: string | null
  account_id: string | null
  status_before: string | null
  result: 'would_cancel' | 'cancelled' | 'skipped' | 'error'
  details: Record<string, unknown>
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function phoneE164(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`
  }
  if (digits.length === 10 && digits.startsWith('7')) return `+7${digits}`
  return null
}

async function isAdminRequest(req: Request, admin: SupabaseClient): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (timingSafeEqual(token, serviceKey)) return true

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return false
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle<{ role: string }>()
  return profile?.role === 'admin'
}

function tiptopClient(publicId: string, apiSecret: string) {
  const authorization = `Basic ${btoa(`${publicId}:${apiSecret}`)}`
  return async function call<T>(path: string, body: Record<string, unknown>) {
    const res = await fetch(`${TIPTOP_API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        'X-Request-ID': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`TipTop ${path}: HTTP ${res.status}`)
    const payload = (await res.json()) as TipTopResponse<T>
    if (payload.Success === false) {
      throw new Error(`TipTop ${path}: ${payload.Message ?? 'Success=false'}`)
    }
    return payload.Model as T
  }
}

/** Все AccountId (UUID пользователя, телефон +7…, subscribers.ttp_account_id) и известные Id подписок. */
async function collectTargets(admin: SupabaseClient): Promise<Target[]> {
  const pageSize = 1000
  const userByPhone = new Map<string, string>()
  const userIds = new Set<string>()
  const accounts = new Map<string, string | null>()
  const subscriptionIds = new Map<string, string | null>()

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, phone')
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const p of data ?? []) {
      userIds.add(p.id)
      accounts.set(p.id, p.id)
      const phone = phoneE164(p.phone)
      if (phone) {
        userByPhone.set(phone, p.id)
        accounts.set(phone, p.id)
      }
    }
    if (!data || data.length < pageSize) break
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('subscribers')
      .select('ttp_account_id, phone')
      .order('ttp_account_id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const s of data ?? []) {
      const raw = String(s.ttp_account_id ?? '').trim()
      const phone = phoneE164(s.phone)
      const userId = userIds.has(raw)
        ? raw
        : (phone && userByPhone.get(phone)) || userByPhone.get(phoneE164(raw) ?? '') || null
      if (raw && !accounts.has(raw)) accounts.set(raw, userId)
      if (phone && !accounts.has(phone)) accounts.set(phone, userId)
    }
    if (!data || data.length < pageSize) break
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('subscriptions')
      .select('user_id, tiptop_subscription_id')
      .not('tiptop_subscription_id', 'is', null)
      .order('tiptop_subscription_id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const s of data ?? []) {
      const id = String(s.tiptop_subscription_id ?? '').trim()
      if (id) subscriptionIds.set(id, s.user_id ?? null)
    }
    if (!data || data.length < pageSize) break
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('payments')
      .select('raw_json')
      .order('created_at')
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const p of data ?? []) {
      const raw = (p.raw_json ?? {}) as Record<string, unknown>
      const id = String(raw.SubscriptionId ?? '').trim()
      if (id && !subscriptionIds.has(id)) subscriptionIds.set(id, null)
      const accountId = String(raw.AccountId ?? '').trim()
      if (accountId && !accounts.has(accountId)) {
        accounts.set(
          accountId,
          userIds.has(accountId) ? accountId : userByPhone.get(phoneE164(accountId) ?? '') ?? null,
        )
      }
    }
    if (!data || data.length < pageSize) break
  }

  const targets: Target[] = [...accounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([accountId, userId]) => ({ kind: 'account', accountId, userId }))
  for (const [subscriptionId, userId] of [...subscriptionIds.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    targets.push({ kind: 'subscription', subscriptionId, userId })
  }
  return targets
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Use POST' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Supabase env is not configured' }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (!(await isAdminRequest(req, admin))) {
    return json({ error: 'Forbidden' }, 403)
  }

  const publicId = Deno.env.get('TIPTOP_PUBLIC_ID')
  const apiSecret = Deno.env.get('TIPTOP_API_SECRET')
  if (!publicId || !apiSecret) {
    return json({ error: 'Secrets TIPTOP_PUBLIC_ID / TIPTOP_API_SECRET are not set' }, 500)
  }

  const url = new URL(req.url)
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return json({ error: 'Body must be JSON' }, 400)
  }

  const dryRunParam = url.searchParams.get('dry_run') ?? body.dry_run
  const dryRun = !(dryRunParam === false || String(dryRunParam).toLowerCase() === 'false')
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? body.offset ?? 0) || 0)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get('limit') ?? body.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
  )
  const runIdParam = String(url.searchParams.get('run_id') ?? body.run_id ?? '').trim()
  const runId = /^[0-9a-f-]{36}$/i.test(runIdParam) ? runIdParam : crypto.randomUUID()

  let targets: Target[]
  try {
    targets = await collectTargets(admin)
  } catch (error) {
    return json({ error: `Failed to collect accounts: ${String(error)}` }, 500)
  }

  const page = targets.slice(offset, offset + limit)
  const call = tiptopClient(publicId, apiSecret)
  const logs: LogRow[] = []
  const seenInRun = new Set<string>()
  let accountsWithSubscriptions = 0

  const { data: alreadyLogged, error: loggedError } = await admin
    .from('subscription_cancel_log')
    .select('tiptop_subscription_id')
    .eq('run_id', runId)
    .not('tiptop_subscription_id', 'is', null)
  if (loggedError) {
    return json({ error: `Failed to read subscription_cancel_log: ${loggedError.message}` }, 500)
  }
  for (const row of alreadyLogged ?? []) {
    seenInRun.add(String(row.tiptop_subscription_id))
  }

  async function handleSubscription(
    sub: TipTopSubscription,
    userId: string | null,
    accountId: string | null,
  ) {
    if (seenInRun.has(sub.Id)) return
    seenInRun.add(sub.Id)

    const status = String(sub.Status ?? '')
    const base = {
      run_id: runId,
      dry_run: dryRun,
      tiptop_subscription_id: sub.Id,
      user_id: userId,
      account_id: sub.AccountId ?? accountId,
      status_before: status || null,
    }
    const details = {
      amount: sub.Amount ?? null,
      currency: sub.Currency ?? null,
      next_charge_at: sub.NextTransactionDateIso ?? null,
    }

    if (!CANCELLABLE.has(status.toLowerCase())) {
      logs.push({ ...base, result: 'skipped', details })
      return
    }
    if (dryRun) {
      logs.push({ ...base, result: 'would_cancel', details })
      return
    }
    try {
      await call('/subscriptions/cancel', { Id: sub.Id })
      logs.push({ ...base, result: 'cancelled', details })
    } catch (error) {
      logs.push({ ...base, result: 'error', details: { ...details, error: String(error) } })
    }
  }

  async function handleTarget(target: Target) {
    try {
      if (target.kind === 'account') {
        const found = await call<TipTopSubscription[] | null>('/subscriptions/find', {
          accountId: target.accountId,
        })
        const subs = Array.isArray(found) ? found : []
        if (subs.length > 0) accountsWithSubscriptions += 1
        for (const sub of subs) {
          await handleSubscription(sub, target.userId, target.accountId)
        }
      } else {
        const sub = await call<TipTopSubscription | null>('/subscriptions/get', {
          Id: target.subscriptionId,
        })
        if (sub?.Id) await handleSubscription(sub, target.userId, null)
      }
    } catch (error) {
      logs.push({
        run_id: runId,
        dry_run: dryRun,
        tiptop_subscription_id: target.kind === 'subscription' ? target.subscriptionId : null,
        user_id: target.userId,
        account_id: target.kind === 'account' ? target.accountId : null,
        status_before: null,
        result: 'error',
        details: { stage: target.kind === 'account' ? 'find' : 'get', error: String(error) },
      })
    }
  }

  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, page.length) }, async () => {
      while (cursor < page.length) {
        const target = page[cursor++]
        await handleTarget(target)
      }
    }),
  )

  let logInsertError: string | null = null
  if (logs.length > 0) {
    const { error } = await admin.from('subscription_cancel_log').insert(logs)
    if (error) logInsertError = error.message
  }

  const summary = { would_cancel: 0, cancelled: 0, skipped: 0, error: 0 }
  for (const row of logs) summary[row.result] += 1

  const nextOffset = offset + page.length < targets.length ? offset + page.length : null

  return json({
    run_id: runId,
    dry_run: dryRun,
    total_targets: targets.length,
    offset,
    limit,
    processed: page.length,
    next_offset: nextOffset,
    accounts_with_subscriptions: accountsWithSubscriptions,
    summary,
    log_insert_error: logInsertError,
    to_cancel: logs
      .filter((r) => r.result === 'would_cancel' || r.result === 'cancelled' || r.result === 'error')
      .map((r) => ({
        subscription_id: r.tiptop_subscription_id,
        account_id: r.account_id,
        status_before: r.status_before,
        result: r.result,
        error: r.details.error ?? null,
      })),
  })
})
