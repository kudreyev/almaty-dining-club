'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizePromoCode } from '@/lib/promo-codes'

const PATH = '/admin/promo-codes'

function fail(code: string): never {
  redirect(`${PATH}?error=${code}`)
}

function parseAppliesTo(raw: unknown): 'first_month' | 'forever' {
  return raw === 'forever' ? 'forever' : 'first_month'
}

function parseDiscountType(raw: unknown): 'percent' | 'fixed' {
  return raw === 'fixed' ? 'fixed' : 'percent'
}

export async function createPromoCode(formData: FormData) {
  await requireAdmin()
  const db = createSupabaseAdminClient()

  const code = normalizePromoCode(String(formData.get('code') ?? ''))
  if (!code) fail('invalid_code')

  const discountType = parseDiscountType(formData.get('discount_type'))
  const valueRaw = Number(formData.get('discount_value'))
  if (!Number.isFinite(valueRaw) || valueRaw <= 0) fail('invalid_discount')

  let discount_percent: number | null = null
  let fixed_amount: number | null = null

  if (discountType === 'percent') {
    if (valueRaw > 100) fail('invalid_discount')
    discount_percent = Math.round(valueRaw * 100) / 100
  } else {
    fixed_amount = Math.round(valueRaw)
  }

  const applies_to = parseAppliesTo(formData.get('applies_to'))

  const maxUsesRaw = String(formData.get('max_uses') ?? '').trim()
  let max_uses: number | null = null
  if (maxUsesRaw) {
    const n = Number(maxUsesRaw)
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) fail('invalid_max_uses')
    max_uses = n
  }

  const expiresRaw = String(formData.get('expires_at') ?? '').trim()
  let expires_at: string | null = null
  if (expiresRaw) {
    const d = new Date(expiresRaw)
    if (Number.isNaN(d.getTime())) fail('invalid_expires')
    expires_at = d.toISOString()
  }

  const campaignRaw = String(formData.get('campaign_tag') ?? '').trim()
  const campaign_tag = campaignRaw ? campaignRaw.slice(0, 128) : null

  const { error } = await db.from('promo_codes').insert({
    code,
    discount_percent,
    fixed_amount,
    applies_to,
    max_uses,
    expires_at,
    campaign_tag,
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') fail('duplicate')
    throw new Error(error.message)
  }

  revalidatePath(PATH)
  redirect(`${PATH}?created=1`)
}

export async function togglePromoActive(formData: FormData) {
  await requireAdmin()
  const db = createSupabaseAdminClient()

  const id = String(formData.get('id') ?? '').trim()
  const nextActive = String(formData.get('is_active') ?? '') === 'true'
  if (!id) fail('invalid_id')

  const { error } = await db
    .from('promo_codes')
    .update({ is_active: nextActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath(PATH)
  redirect(`${PATH}?updated=${nextActive ? 'activated' : 'deactivated'}`)
}
