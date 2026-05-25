'use server'

import { requireAdminOrThrow } from '@/lib/admin'
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
  coexistenceWarning?: string
}

export type CompleteEmbeddedSignupResponse =
  | { ok: true; result: CompleteEmbeddedSignupResult }
  | { ok: false; error: string; step: string }

export async function completeEmbeddedSignup(
  input: CompleteEmbeddedSignupInput,
): Promise<CompleteEmbeddedSignupResponse> {
  try {
    await requireAdminOrThrow('/admin/whatsapp/connect')

    const code = input.code.trim()
    if (!code) {
      return { ok: false, error: 'Пустой code от Meta', step: 'validate' }
    }

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
      ok: true,
      result: {
        wabaId,
        phoneNumberId,
        businessId: input.businessId?.trim() || undefined,
        event: input.event?.trim() || 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
        accessToken,
        expiresIn,
        isOnBizApp: coexistence.isOnBizApp,
        platformType: coexistence.platformType,
        assetSource,
        coexistenceWarning: coexistence.warning,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка onboarding'
    const step = message.includes('обмен') || message.includes('redirect_uri')
      ? 'exchange'
      : message.includes('WABA') || message.includes('debug_token')
        ? 'discover'
        : message.includes('admin') || message.includes('Сессия')
          ? 'auth'
          : 'unknown'

    return { ok: false, error: message, step }
  }
}
