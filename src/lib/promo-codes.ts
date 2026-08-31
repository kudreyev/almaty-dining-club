/**
 * Промокоды чекаута: валидация, расчёт цены, инкремент used_count после Pay.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { MIN_CHECKOUT_AMOUNT_KZT, PRICE_KZT } from '@/lib/pricing'

export type PromoAppliesTo = 'first_month' | 'forever'

export type PromoCodeRow = {
  id: string
  code: string
  discount_percent: number | null
  fixed_amount: number | null
  applies_to: PromoAppliesTo
  max_uses: number | null
  used_count: number
  expires_at: string | null
  campaign_tag: string | null
  is_active: boolean
}

export type PromoValidateError =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'exhausted'
  | 'invalid'

export type PromoValidateOk = {
  ok: true
  code: string
  applies_to: PromoAppliesTo
  campaign_tag: string | null
  /** Цена первого (инитного) платежа. */
  first_amount: number
  /** Сумма рекуррентных списаний (TipTop recurrent.amount). */
  recurrent_amount: number
  base_amount: number
}

export type PromoValidateFail = {
  ok: false
  error: PromoValidateError
  message: string
}

export type PromoValidateResult = PromoValidateOk | PromoValidateFail

const ERROR_MESSAGES: Record<PromoValidateError, string> = {
  not_found: 'Промокод не найден.',
  inactive: 'Промокод больше не действует.',
  expired: 'Срок действия промокода истёк.',
  exhausted: 'Промокод уже использован максимальное число раз.',
  invalid: 'Некорректный промокод.',
}

function admin() {
  return createSupabaseAdminClient()
}

export function normalizePromoCode(raw: string): string {
  // Убираем SQL LIKE-метасимволы — код только буквы/цифры/дефис.
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 64)
}

/**
 * fixed_amount — скидка в тенге (вычитается из базы).
 * discount_percent — процент скидки.
 */
export function computePromoAmounts(
  baseAmount: number,
  promo: Pick<PromoCodeRow, 'discount_percent' | 'fixed_amount' | 'applies_to'>,
): { first_amount: number; recurrent_amount: number } {
  let discounted = baseAmount

  if (promo.discount_percent != null) {
    discounted = Math.round(baseAmount * (1 - Number(promo.discount_percent) / 100))
  } else if (promo.fixed_amount != null) {
    discounted = Math.round(baseAmount - Number(promo.fixed_amount))
  }

  discounted = Math.max(MIN_CHECKOUT_AMOUNT_KZT, discounted)

  if (promo.applies_to === 'forever') {
    return { first_amount: discounted, recurrent_amount: discounted }
  }

  return { first_amount: discounted, recurrent_amount: baseAmount }
}

export async function findPromoCodeByCode(
  codeRaw: string,
): Promise<PromoCodeRow | null> {
  const code = normalizePromoCode(codeRaw)
  if (!code) return null

  const { data, error } = await admin()
    .from('promo_codes')
    .select(
      'id, code, discount_percent, fixed_amount, applies_to, max_uses, used_count, expires_at, campaign_tag, is_active',
    )
    .ilike('code', code)
    .maybeSingle<PromoCodeRow>()

  if (error) throw error
  return data ?? null
}

/** Валидация без инкремента used_count. */
export async function validatePromoCode(
  codeRaw: string,
  baseAmount: number = PRICE_KZT,
): Promise<PromoValidateResult> {
  const normalized = normalizePromoCode(codeRaw)
  if (!normalized) {
    return { ok: false, error: 'invalid', message: ERROR_MESSAGES.invalid }
  }

  const promo = await findPromoCodeByCode(normalized)
  if (!promo) {
    return { ok: false, error: 'not_found', message: ERROR_MESSAGES.not_found }
  }

  if (!promo.is_active) {
    return { ok: false, error: 'inactive', message: ERROR_MESSAGES.inactive }
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'expired', message: ERROR_MESSAGES.expired }
  }

  if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
    return { ok: false, error: 'exhausted', message: ERROR_MESSAGES.exhausted }
  }

  const amounts = computePromoAmounts(baseAmount, promo)

  return {
    ok: true,
    code: normalizePromoCode(promo.code),
    applies_to: promo.applies_to,
    campaign_tag: promo.campaign_tag,
    first_amount: amounts.first_amount,
    recurrent_amount: amounts.recurrent_amount,
    base_amount: baseAmount,
  }
}

/** Инкремент после подтверждённой оплаты. Идемпотентность — на стороне вызывающего. */
export async function incrementPromoCodeUsage(codeRaw: string): Promise<boolean> {
  const code = normalizePromoCode(codeRaw)
  if (!code) return false

  const { data, error } = await admin().rpc('increment_promo_code_usage', {
    p_code: code,
  })

  if (error) throw error
  return Boolean(data)
}
