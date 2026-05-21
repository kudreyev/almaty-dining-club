'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { normalizeToE164Like } from '@/lib/kz-phone'
import {
  checkTrialAvailability,
  generateHashedActivationToken,
  type ActivationLinkKind,
} from '@/lib/activation-links'
import { logAnalyticsEvent } from '@/lib/analytics'

const TRIAL_DAYS = 14

function parseKind(raw: unknown): ActivationLinkKind {
  return raw === 'trial' ? 'trial' : 'paid'
}

export async function createActivationLink(formData: FormData) {
  const { supabase } = await requireAdmin()

  const phoneRaw = String(formData.get('phone_target') ?? '').trim()
  const kind = parseKind(formData.get('kind'))

  const phoneTarget = normalizeToE164Like(phoneRaw)
  if (!phoneTarget) {
    redirect('/admin/activation-links?error=invalid_phone')
  }

  if (kind === 'trial') {
    const availability = await checkTrialAvailability(phoneTarget)
    if (!availability.ok) {
      const errorCode =
        availability.reason === 'pending_trial_link'
          ? 'trial_link_pending'
          : 'trial_already_used'
      redirect(`/admin/activation-links?error=${errorCode}`)
    }
  }

  const amount =
    kind === 'trial'
      ? 0
      : (() => {
          const amountRaw = Number(formData.get('amount'))
          return Number.isFinite(amountRaw) && amountRaw > 0
            ? Math.floor(amountRaw)
            : 1990
        })()

  const token = generateHashedActivationToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: inserted, error } = await supabase
    .from('activation_links')
    .insert({
      token,
      phone_target: phoneTarget,
      amount,
      currency: 'KZT',
      status: 'issued',
      expires_at: expiresAt,
      kind,
      trial_days: kind === 'trial' ? TRIAL_DAYS : null,
    })
    .select('id, token, phone_target')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await logAnalyticsEvent({
    event_name: 'activation_link_created',
    activation_link_id: inserted?.id ?? null,
    token: inserted?.token ?? token,
    phone_target: inserted?.phone_target ?? phoneTarget,
    meta: {
      amount,
      source: 'admin',
      kind,
      trial_days: kind === 'trial' ? TRIAL_DAYS : null,
    },
  })

  revalidatePath('/admin/activation-links')
  redirect(
    `/admin/activation-links?created=${kind === 'trial' ? 'trial' : 'paid'}`,
  )
}
