// src/lib/checkout/otp-rate-limit.ts
// Ограничение частоты отправки WhatsApp-OTP в чекауте подписки.
// Самрегистрация в чекауте открыта для гостей, поэтому отправку кода нужно
// защитить от абьюза (стоимость Twilio + спам). Ключ — IP-адрес.
//
// Переиспользуем generic-таблицы rate-лимита (redeem_rate_failures /
// redeem_rate_blocks): их схема (key_hash, event_kind, created_at / blocked_until)
// не привязана к redeem, отдельная миграция не нужна. event_kind = 'checkout_otp_send'.

import { createHash } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getRequestClientIp } from '@/lib/request-ip'
import { safeLog } from '@/lib/safe-logger'

const EVENT_KIND = 'checkout_otp_send'

function rateLimitSalt(): string {
  return process.env.RATE_LIMIT_KEY_SALT ?? 'dev-rate-limit-salt-change-me'
}

function keyHashForIp(ip: string): string {
  return createHash('sha256')
    .update(`${rateLimitSalt()}:checkout-otp:${ip}`, 'utf8')
    .digest('hex')
}

async function countSince(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  keyHash: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await admin
    .from('redeem_rate_failures')
    .select('*', { count: 'exact', head: true })
    .eq('key_hash', keyHash)
    .eq('event_kind', EVENT_KIND)
    .gte('created_at', sinceIso)

  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Проверяет, не заблокирован ли текущий IP. Возвращает true, если отправка
 * разрешена. Мягко (best-effort): при сбое БД не блокируем пользователя.
 */
export async function isCheckoutOtpAllowed(): Promise<boolean> {
  try {
    const ip = await getRequestClientIp()
    const keyHash = keyHashForIp(ip)
    const admin = createSupabaseAdminClient()
    const { data: block } = await admin
      .from('redeem_rate_blocks')
      .select('blocked_until')
      .eq('key_hash', keyHash)
      .maybeSingle<{ blocked_until: string }>()

    if (block && new Date(block.blocked_until).getTime() > Date.now()) {
      return false
    }
    return true
  } catch (error) {
    safeLog.error('[checkout-otp-rate-limit] check failed', error)
    return true
  }
}

/**
 * Регистрирует факт отправки кода и при превышении порога ставит блок.
 * Пороги: 5 за 10 минут → блок 10 минут; 15 за час → блок 1 час.
 */
export async function recordCheckoutOtpSend(): Promise<void> {
  try {
    const ip = await getRequestClientIp()
    const keyHash = keyHashForIp(ip)
    const admin = createSupabaseAdminClient()
    const now = Date.now()

    const { error: insErr } = await admin
      .from('redeem_rate_failures')
      .insert({ key_hash: keyHash, event_kind: EVENT_KIND })
    if (insErr) {
      safeLog.error('[checkout-otp-rate-limit] insert failed', insErr)
      return
    }

    const iso10m = new Date(now - 600_000).toISOString()
    const iso1h = new Date(now - 3_600_000).toISOString()

    const c10m = await countSince(admin, keyHash, iso10m)
    const c1h = await countSince(admin, keyHash, iso1h)

    let blockMs = 0
    if (c1h >= 15) blockMs = 3_600_000
    else if (c10m >= 5) blockMs = 600_000

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
      if (upErr) safeLog.error('[checkout-otp-rate-limit] block upsert failed', upErr)
    }
  } catch (error) {
    safeLog.error('[checkout-otp-rate-limit] record failed', error)
  }
}
