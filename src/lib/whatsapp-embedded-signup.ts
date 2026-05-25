import { logServerError } from '@/lib/safe-errors'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

function metaApiError(body: { error?: { message?: string; error_user_msg?: string } }): string {
  return body.error?.error_user_msg ?? body.error?.message ?? 'Meta API error'
}

/** Meta OAuth redirect — всегда kudaclub.kz (не NEXT_PUBLIC_SITE_URL). */
export function getWhatsAppOAuthRedirectUri(): string {
  const override = process.env.WHATSAPP_OAUTH_REDIRECT_URI?.trim()
  if (override) return override
  return 'https://kudaclub.kz/admin/whatsapp/connect'
}

function getOAuthRedirectUri(): string {
  return getWhatsAppOAuthRedirectUri()
}

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
): Promise<{ accessToken: string; expiresIn?: number; redirectUriUsed: string }> {
  const appId = getMetaAppId()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error('Задайте NEXT_PUBLIC_META_APP_ID и WHATSAPP_APP_SECRET')
  }

  const redirectCandidates = [
    getOAuthRedirectUri(),
    'https://kudaclub.kz/',
    'https://kudaclub.kz/admin/whatsapp',
  ]

  let lastError = 'Не удалось обменять code на token'

  for (const redirectUri of redirectCandidates) {
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const body = (await res.json()) as {
      access_token?: string
      expires_in?: number
      error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number }
    }

    if (res.ok && body.access_token) {
      return {
        accessToken: body.access_token,
        expiresIn: body.expires_in,
        redirectUriUsed: redirectUri,
      }
    }

    lastError = metaApiError(body)
    const isRedirectMismatch =
      body.error?.code === 100 ||
      body.error?.error_subcode === 36008 ||
      lastError.toLowerCase().includes('redirect_uri')

    if (!isRedirectMismatch) {
      logServerError('whatsapp-embedded-signup:exchange', new Error(JSON.stringify(body)))
      throw new Error(
        `${lastError} (redirect_uri=${redirectUri}). Проверьте WHATSAPP_APP_SECRET для App ID ${appId}.`,
      )
    }
  }

  // Embedded Signup иногда не передаёт redirect_uri в dialog — пробуем без него.
  const noRedirectParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
    grant_type: 'authorization_code',
  })

  const noRedirectRes = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: noRedirectParams.toString(),
  })
  const noRedirectBody = (await noRedirectRes.json()) as {
    access_token?: string
    expires_in?: number
    error?: { message?: string; error_user_msg?: string }
  }

  if (noRedirectRes.ok && noRedirectBody.access_token) {
    return {
      accessToken: noRedirectBody.access_token,
      expiresIn: noRedirectBody.expires_in,
      redirectUriUsed: '(none)',
    }
  }

  logServerError('whatsapp-embedded-signup:exchange', new Error(JSON.stringify(noRedirectBody)))
  throw new Error(
    `${metaApiError(noRedirectBody) || lastError}. Code живёт ~30 сек — нажмите «Сбросить» и пройдите popup заново. App ID ${appId}.`,
  )
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
    throw new Error(metaApiError(debugBody))
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
    throw new Error(metaApiError(phonesBody))
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
}): Promise<{ isOnBizApp: boolean; platformType: string | null; warning?: string }> {
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
    return {
      isOnBizApp: false,
      platformType: null,
      warning: metaApiError(body),
    }
  }

  return {
    isOnBizApp: body.is_on_biz_app === true,
    platformType: body.platform_type ?? null,
  }
}
