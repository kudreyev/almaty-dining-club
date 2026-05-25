import { logServerError } from '@/lib/safe-errors'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

export function getEmbeddedSignupConfigId(): string | null {
  return process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || null
}

export function getMetaAppId(): string | null {
  return process.env.NEXT_PUBLIC_META_APP_ID?.trim() || null
}

export function isEmbeddedSignupConfigured(): boolean {
  return Boolean(getMetaAppId() && getEmbeddedSignupConfigId())
}

export async function exchangeEmbeddedSignupCode(
  code: string,
): Promise<{ accessToken: string; expiresIn?: number }> {
  const appId = getMetaAppId()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error('Задайте NEXT_PUBLIC_META_APP_ID и WHATSAPP_APP_SECRET')
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('code', code)

  const res = await fetch(url.toString())
  const body = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error?: { message?: string }
  }

  if (!res.ok || !body.access_token) {
    logServerError('whatsapp-embedded-signup:exchange', new Error(JSON.stringify(body)))
    throw new Error(body.error?.message ?? 'Не удалось обменять code на token')
  }

  return { accessToken: body.access_token, expiresIn: body.expires_in }
}

function getAppAccessToken(): string {
  const appId = getMetaAppId()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error('Задайте NEXT_PUBLIC_META_APP_ID и WHATSAPP_APP_SECRET')
  }
  return `${appId}|${appSecret}`
}

/** Fallback, если session logging не прислал waba_id / phone_number_id. */
export async function discoverWhatsAppAssetsFromToken(
  accessToken: string,
): Promise<{ wabaId: string; phoneNumberId: string }> {
  const appAccessToken = getAppAccessToken()

  const debugUrl = new URL(`${GRAPH_BASE}/debug_token`)
  debugUrl.searchParams.set('input_token', accessToken)
  debugUrl.searchParams.set('access_token', appAccessToken)

  const debugRes = await fetch(debugUrl.toString())
  const debugBody = (await debugRes.json()) as {
    data?: {
      granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>
    }
    error?: { message?: string }
  }

  if (!debugRes.ok) {
    logServerError('whatsapp-embedded-signup:debug_token', new Error(JSON.stringify(debugBody)))
    throw new Error(debugBody.error?.message ?? 'debug_token failed')
  }

  const scopes = debugBody.data?.granular_scopes ?? []
  const wabaId =
    scopes
      .filter((s) =>
        s.scope === 'whatsapp_business_management' || s.scope === 'whatsapp_business_messaging',
      )
      .flatMap((s) => s.target_ids ?? [])
      .find(Boolean) ?? null

  if (!wabaId) {
    throw new Error(
      'WABA не найден в token. В Meta включите session logging в Embedded Signup configuration.',
    )
  }

  const phonesUrl = new URL(`${GRAPH_BASE}/${wabaId}/phone_numbers`)
  phonesUrl.searchParams.set('fields', 'id,display_phone_number,verified_name')

  const phonesRes = await fetch(phonesUrl.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  const phonesBody = (await phonesRes.json()) as {
    data?: Array<{ id?: string; display_phone_number?: string }>
    error?: { message?: string }
  }

  if (!phonesRes.ok) {
    logServerError('whatsapp-embedded-signup:phone_numbers', new Error(JSON.stringify(phonesBody)))
    throw new Error(phonesBody.error?.message ?? 'Не удалось получить phone_number_id')
  }

  const phones = phonesBody.data ?? []
  const preferred =
    phones.find((p) => p.display_phone_number?.replace(/\D/g, '').includes('77066059899')) ??
    phones[0]

  if (!preferred?.id) {
    throw new Error('У WABA нет подключённых номеров телефона')
  }

  return { wabaId, phoneNumberId: preferred.id }
}

export async function fetchPhoneCoexistenceStatus(args: {
  phoneNumberId: string
  accessToken: string
}): Promise<{ isOnBizApp: boolean; platformType: string | null }> {
  const url = new URL(`${GRAPH_BASE}/${args.phoneNumberId}`)
  url.searchParams.set('fields', 'is_on_biz_app,platform_type')

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${args.accessToken}` },
  })

  const body = (await res.json()) as {
    is_on_biz_app?: boolean
    platform_type?: string
    error?: { message?: string }
  }

  if (!res.ok) {
    logServerError('whatsapp-embedded-signup:coexistence', new Error(JSON.stringify(body)))
    throw new Error(body.error?.message ?? 'Не удалось проверить coexistence')
  }

  return {
    isOnBizApp: body.is_on_biz_app === true,
    platformType: body.platform_type ?? null,
  }
}
