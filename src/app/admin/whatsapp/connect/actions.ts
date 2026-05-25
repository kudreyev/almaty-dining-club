'use server'

import { requireAdmin } from '@/lib/admin'
import {
  discoverWhatsAppAssetsFromToken,
  exchangeEmbeddedSignupCode,
  fetchPhoneCoexistenceStatus,
} from '@/lib/whatsapp-embedded-signup'

export type CompleteEmbeddedSignupInput = {
  code: string
  wabaId?: string
  phoneNumberId?: string
  businessId?: string
  event?: string
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
  assetSource: 'session' | 'graph_api'
}

export async function completeEmbeddedSignup(
  input: CompleteEmbeddedSignupInput,
): Promise<CompleteEmbeddedSignupResult> {
  await requireAdmin()

  const code = input.code.trim()
  if (!code) throw new Error('Пустой code')

  const { accessToken, expiresIn } = await exchangeEmbeddedSignupCode(code)

  let wabaId = input.wabaId?.trim() || ''
  let phoneNumberId = input.phoneNumberId?.trim() || ''
  let assetSource: 'session' | 'graph_api' = 'session'

  if (!wabaId || !phoneNumberId) {
    const discovered = await discoverWhatsAppAssetsFromToken(accessToken)
    wabaId = wabaId || discovered.wabaId
    phoneNumberId = phoneNumberId || discovered.phoneNumberId
    assetSource = 'graph_api'
  }

  const coexistence = await fetchPhoneCoexistenceStatus({ phoneNumberId, accessToken })

  return {
    wabaId,
    phoneNumberId,
    businessId: input.businessId?.trim() || undefined,
    event: input.event?.trim() || 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
    accessToken,
    expiresIn,
    isOnBizApp: coexistence.isOnBizApp,
    platformType: coexistence.platformType,
    assetSource,
  }
}
