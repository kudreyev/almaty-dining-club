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
  preferredRedirectUri?: string,
): Promise<{ accessToken: string; expiresIn?: number; redirectUriUsed: string }> {
  const appId = getMetaAppId()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error('Задайте NEXT_PUBLIC_META_APP_ID и WHATSAPP_APP_SECRET')
  }

  const redirectCandidates = [
    ...new Set(
      [preferredRedirectUri, getOAuthRedirectUri(), 'https://kudaclub.kz/', 'https://kudaclub.kz/admin/whatsapp'].filter(
        (v): v is string => Boolean(v?.trim()),
      ),
    ),
  ]

  let lastError = 'Не удалось обменять code на token'

  for (const redirectUri of redirectCandidates) {
    for (const attempt of [tryPostExchange, tryGetExchange]) {
      const result = await attempt({ appId, appSecret, code, redirectUri })
      if (result.ok) {
        return {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          redirectUriUsed: redirectUri,
        }
      }
      lastError = result.error
      const isRedirectMismatch =
        result.errorCode === 100 ||
        result.errorSubcode === 36008 ||
        result.error.toLowerCase().includes('redirect_uri')
      if (!isRedirectMismatch) {
        logServerError('whatsapp-embedded-signup:exchange', new Error(result.raw))
        throw new Error(`${result.error} (redirect_uri=${redirectUri}). App ID ${appId}.`)
      }
    }
  }

  for (const attempt of [tryPostExchange, tryGetExchange]) {
    const result = await attempt({ appId, appSecret, code })
    if (result.ok) {
      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        redirectUriUsed: '(none)',
      }
    }
    lastError = result.error
  }

  logServerError('whatsapp-embedded-signup:exchange', new Error(lastError))
  throw new Error(
    `${lastError}. Code одноразовый (~30 сек): «Сбросить» → новый проход Meta. Не обновляйте страницу с ?code= в URL повторно.`,
  )
}

async function tryPostExchange(args: {
  appId: string
  appSecret: string
  code: string
  redirectUri?: string
}): Promise<ExchangeAttempt> {
  const params = new URLSearchParams({
    client_id: args.appId,
    client_secret: args.appSecret,
    code: args.code,
    grant_type: 'authorization_code',
  })
  if (args.redirectUri) params.set('redirect_uri', args.redirectUri)

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  return parseExchangeResponse(res)
}

async function tryGetExchange(args: {
  appId: string
  appSecret: string
  code: string
  redirectUri?: string
}): Promise<ExchangeAttempt> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('client_id', args.appId)
  url.searchParams.set('client_secret', args.appSecret)
  url.searchParams.set('code', args.code)
  url.searchParams.set('grant_type', 'authorization_code')
  if (args.redirectUri) url.searchParams.set('redirect_uri', args.redirectUri)

  const res = await fetch(url.toString())
  return parseExchangeResponse(res)
}

type ExchangeAttempt =
  | { ok: true; accessToken: string; expiresIn?: number }
  | { ok: false; error: string; errorCode?: number; errorSubcode?: number; raw: string }

async function parseExchangeResponse(res: Response): Promise<ExchangeAttempt> {
  const body = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number }
  }

  if (res.ok && body.access_token) {
    return { ok: true, accessToken: body.access_token, expiresIn: body.expires_in }
  }

  return {
    ok: false,
    error: metaApiError(body),
    errorCode: body.error?.code,
    errorSubcode: body.error?.error_subcode,
    raw: JSON.stringify(body),
  }
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
  const kzPhone =
    phones.find((p) => p.display_phone_number?.replace(/\D/g, '').includes('77066059899')) ?? null

  if (!kzPhone?.id) {
    const listed = phones
      .map((p) => p.display_phone_number ?? p.id)
      .filter(Boolean)
      .join(', ')
    throw new Error(
      `Номер 77066059899 не привязан к WABA. В Meta пройдите «Подключить существующий WhatsApp Business». Сейчас в WABA: ${listed || 'нет номеров'}.`,
    )
  }

  return { wabaId, phoneNumberId: kzPhone.id }
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
