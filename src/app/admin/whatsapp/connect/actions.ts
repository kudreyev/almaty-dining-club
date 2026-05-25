'use server'

import { requireAdminOrThrow } from '@/lib/admin'
import {
  discoverWhatsAppAssetsFromToken,
  exchangeEmbeddedSignupCode,
  fetchPhoneCoexistenceStatus,
} from '@/lib/whatsapp-embedded-signup'

export type CompleteEmbeddedSignupInput = {
  code: string
  oauthRedirectUri?: string
  oauthExchangeMode?: 'js_sdk_popup' | 'oauth_redirect'
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

    const { accessToken, expiresIn } = await exchangeEmbeddedSignupCode(code, {
      preferredRedirectUri: input.oauthRedirectUri?.trim() || undefined,
      mode: input.oauthExchangeMode ?? 'js_sdk_popup',
    })

    const hadSessionIds = Boolean(input.wabaId?.trim() && input.phoneNumberId?.trim())
    const discovered = await discoverWhatsAppAssetsFromToken(accessToken)
    const wabaId = discovered.wabaId
    const phoneNumberId = discovered.phoneNumberId
    const assetSource: 'session' | 'graph_api' = hadSessionIds ? 'session' : 'graph_api'

    const event = input.event?.trim() || 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
    const coexistenceEventMismatch =
      event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        ? `Событие Meta: ${event} (ожидали FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING — coexistence не завершён).`
        : undefined

    const coexistence = await fetchPhoneCoexistenceStatus({ phoneNumberId, accessToken })

    return {
      ok: true,
      result: {
        wabaId,
        phoneNumberId,
        businessId: input.businessId?.trim() || undefined,
        event,
        accessToken,
        expiresIn,
        isOnBizApp: coexistence.isOnBizApp,
        platformType: coexistence.platformType,
        assetSource,
        coexistenceWarning: [coexistenceEventMismatch, coexistence.warning].filter(Boolean).join(' ') || undefined,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка onboarding'
    const step = message.includes('обмен') || message.includes('redirect_uri')
      ? 'exchange'
      : message.includes('WABA') ||
          message.includes('debug_token') ||
          message.includes('77066059899') ||
          message.includes('не привязан')
        ? 'discover'
        : message.includes('admin') || message.includes('Сессия')
          ? 'auth'
          : 'unknown'

    return { ok: false, error: message, step }
  }
}
