// Ограничение частоты отправки WhatsApp-OTP при входе и регистрации.
// Регистрация открыта всем, поэтому отправку кода защищаем от абьюза
// (стоимость Twilio, спам чужого номера): отдельно по IP и по номеру.
//
// Используем generic-таблицы rate-лимита (redeem_rate_failures /
// redeem_rate_blocks): схема (key_hash, event_kind, created_at / blocked_until)
// не привязана к redeem.

import { createHash } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getRequestClientIp } from '@/lib/request-ip'
import { safeLog } from '@/lib/safe-logger'

const EVENT_KIND = 'login_otp_send'

type Limit = { windowMs: number; max: number; blockMs: number }

/** IP: 5 за 10 минут → блок 10 минут; 15 за час → блок 1 час. */
const IP_LIMITS: Limit[] = [
  { windowMs: 3_600_000, max: 15, blockMs: 3_600_000 },
  { windowMs: 600_000, max: 5, blockMs: 600_000 },
]

/** Номер: 3 за 10 минут → блок 10 минут; 6 за час → блок 1 час. */
const PHONE_LIMITS: Limit[] = [
  { windowMs: 3_600_000, max: 6, blockMs: 3_600_000 },
  { windowMs: 600_000, max: 3, blockMs: 600_000 },
]

function rateLimitSalt(): string {
  return process.env.RATE_LIMIT_KEY_SALT ?? 'dev-rate-limit-salt-change-me'
}

function keyHash(kind: 'ip' | 'phone', value: string): string {
  return createHash('sha256')
    .update(`${rateLimitSalt()}:login-otp:${kind}:${value}`, 'utf8')
    .digest('hex')
}

async function isBlocked(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  hash: string,
): Promise<boolean> {
  const { data: block } = await admin
    .from('redeem_rate_blocks')
    .select('blocked_until')
    .eq('key_hash', hash)
    .maybeSingle<{ blocked_until: string }>()
  return Boolean(block && new Date(block.blocked_until).getTime() > Date.now())
}

async function countSince(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  hash: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from('redeem_rate_failures')
    .select('*', { count: 'exact', head: true })
    .eq('key_hash', hash)
    .eq('event_kind', EVENT_KIND)
    .gte('created_at', sinceIso)

  if (error) throw new Error(error.message)
  return count ?? 0
}

async function recordAndMaybeBlock(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  hash: string,
  limits: Limit[],
): Promise<void> {
  const { error: insErr } = await admin
    .from('redeem_rate_failures')
    .insert({ key_hash: hash, event_kind: EVENT_KIND })
  if (insErr) {
    safeLog.error('[login-otp-rate-limit] insert failed', insErr)
    return
  }

  const now = Date.now()
  let blockMs = 0
  for (const limit of limits) {
    const count = await countSince(admin, hash, new Date(now - limit.windowMs).toISOString())
    if (count >= limit.max) {
      blockMs = limit.blockMs
      break
    }
  }
  if (blockMs === 0) return

  const { data: existing } = await admin
    .from('redeem_rate_blocks')
    .select('blocked_until')
    .eq('key_hash', hash)
    .maybeSingle<{ blocked_until: string }>()

  const existingEnd = existing ? new Date(existing.blocked_until).getTime() : 0
  const blockedUntilIso = new Date(Math.max(now + blockMs, existingEnd)).toISOString()

  const { error: upErr } = await admin.from('redeem_rate_blocks').upsert(
    {
      key_hash: hash,
      blocked_until: blockedUntilIso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key_hash' },
  )
  if (upErr) safeLog.error('[login-otp-rate-limit] block upsert failed', upErr)
}

/**
 * true — отправка разрешена. Best-effort: при сбое БД пользователя не блокируем.
 */
export async function isLoginOtpAllowed(phoneE164: string): Promise<boolean> {
  try {
    const ip = await getRequestClientIp()
    const admin = createSupabaseAdminClient()
    const [ipBlocked, phoneBlocked] = await Promise.all([
      isBlocked(admin, keyHash('ip', ip)),
      isBlocked(admin, keyHash('phone', phoneE164)),
    ])
    return !ipBlocked && !phoneBlocked
  } catch (error) {
    safeLog.error('[login-otp-rate-limit] check failed', error)
    return true
  }
}

export async function recordLoginOtpSend(phoneE164: string): Promise<void> {
  try {
    const ip = await getRequestClientIp()
    const admin = createSupabaseAdminClient()
    await Promise.all([
      recordAndMaybeBlock(admin, keyHash('ip', ip), IP_LIMITS),
      recordAndMaybeBlock(admin, keyHash('phone', phoneE164), PHONE_LIMITS),
    ])
  } catch (error) {
    safeLog.error('[login-otp-rate-limit] record failed', error)
  }
}
