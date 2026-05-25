'use server'

import { requireAdmin } from '@/lib/admin'
import {
  exchangeEmbeddedSignupCode,
  fetchPhoneCoexistenceStatus,
} from '@/lib/whatsapp-embedded-signup'

export type CompleteEmbeddedSignupInput = {
  code: string
  wabaId: string
  phoneNumberId: string
  businessId?: string
  event: string
}

export type CompleteEmbeddedSignupResult = {
  wabaId: string
  phoneNumberId: string
  businessId?: string
  event: string
  accessToken: string
  expiresIn?: number
  isOnBizApp: boolean
  platformType: string | null
}

export async function completeEmbeddedSignup(
  input: CompleteEmbeddedSignupInput,
): Promise<CompleteEmbeddedSignupResult> {
  await requireAdmin()

  const code = input.code.trim()
  const wabaId = input.wabaId.trim()
  const phoneNumberId = input.phoneNumberId.trim()

  if (!code) throw new Error('Пустой code')
  if (!wabaId) throw new Error('Не получен waba_id')
  if (!phoneNumberId) throw new Error('Не получен phone_number_id')

  const { accessToken, expiresIn } = await exchangeEmbeddedSignupCode(code)
  const coexistence = await fetchPhoneCoexistenceStatus({ phoneNumberId, accessToken })

  return {
    wabaId,
    phoneNumberId,
    businessId: input.businessId?.trim() || undefined,
    event: input.event,
    accessToken,
    expiresIn,
    isOnBizApp: coexistence.isOnBizApp,
    platformType: coexistence.platformType,
  }
}
