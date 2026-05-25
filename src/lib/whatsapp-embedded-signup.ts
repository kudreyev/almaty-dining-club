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
