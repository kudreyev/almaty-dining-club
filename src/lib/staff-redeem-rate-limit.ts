import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getRequestClientIp } from '@/lib/request-ip'
import { safeLog } from '@/lib/safe-logger'

function rateLimitSalt(): string {
  return process.env.RATE_LIMIT_KEY_SALT ?? 'dev-rate-limit-salt-change-me'
}

export function hashStaffRedeemRateKey(ip: string): string {
  return createHash('sha256').update(`${rateLimitSalt()}:${ip}`, 'utf8').digest('hex')
}

async function countFailuresSince(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  keyHash: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await admin
    .from('redeem_rate_failures')
    .select('*', { count: 'exact', head: true })
    .eq('key_hash', keyHash)
    .gte('created_at', sinceIso)

  if (error) {
    throw new Error(error.message)
  }
  return count ?? 0
}

/** В начале server action: если key уже заблокирован — редирект. */
export async function assertStaffRedeemNotRateLimited(): Promise<void> {
  const ip = await getRequestClientIp()
  const keyHash = hashStaffRedeemRateKey(ip)
  const admin = createSupabaseAdminClient()
  const { data: block } = await admin
    .from('redeem_rate_blocks')
    .select('blocked_until')
    .eq('key_hash', keyHash)
    .maybeSingle<{ blocked_until: string }>()

  if (block && new Date(block.blocked_until).getTime() > Date.now()) {
    redirect('/staff/redeem?error=rate_limited')
  }
}

/**
 * Записывает неудачную проверку и применяет лимиты.
 * @returns true — в этом же запросе нужно показать rate_limited вместо частной ошибки.
 */
export async function recordStaffRedeemFailure(eventKind: string): Promise<boolean> {
  const ip = await getRequestClientIp()
  const keyHash = hashStaffRedeemRateKey(ip)
  const admin = createSupabaseAdminClient()
  const now = Date.now()

  const { error: insErr } = await admin.from('redeem_rate_failures').insert({
    key_hash: keyHash,
    event_kind: eventKind,
  })
  if (insErr) {
    safeLog.error('[staff-redeem-rate-limit] insert failure', insErr)
    return false
  }

  const iso1m = new Date(now - 60_000).toISOString()
  const iso1h = new Date(now - 3_600_000).toISOString()
  const iso24h = new Date(now - 86_400_000).toISOString()

  const c1m = await countFailuresSince(admin, keyHash, iso1m)
  const c1h = await countFailuresSince(admin, keyHash, iso1h)
  const c24h = await countFailuresSince(admin, keyHash, iso24h)

  let blockMs = 0
  if (c24h >= 100) {
    blockMs = 86_400_000
    if (c24h === 100) {
      safeLog.warn('[staff-redeem-rate-limit] day threshold (100/24h)', {
        keyPrefix: keyHash.slice(0, 12),
      })
    }
  } else if (c1h >= 20) {
    blockMs = 3_600_000
    if (c1h === 20) {
      safeLog.warn('[staff-redeem-rate-limit] hour threshold (20/h)', {
        keyPrefix: keyHash.slice(0, 12),
      })
    }
  } else if (c1m >= 5) {
    blockMs = 600_000
  }

  if (blockMs > 0) {
    const { data: existing } = await admin
      .from('redeem_rate_blocks')
      .select('blocked_until')
      .eq('key_hash', keyHash)
      .maybeSingle<{ blocked_until: string }>()

    const proposedEnd = now + blockMs
    const existingEnd = existing ? new Date(existing.blocked_until).getTime() : 0
    const blockedUntilIso = new Date(Math.max(proposedEnd, existingEnd)).toISOString()

    const { error: upErr } = await admin.from('redeem_rate_blocks').upsert(
      {
        key_hash: keyHash,
        blocked_until: blockedUntilIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key_hash' }
    )
    if (upErr) {
      safeLog.error('[staff-redeem-rate-limit] block upsert failed', upErr)
      return false
    }
    return true
  }

  return false
}
