/**
 * Facebook Marketing API — дневные insights по рекламному кабинету.
 * Env: FB_TOKEN, FB_AD_ACCOUNT (act_XXXXXXXX или числовой id).
 */

export type FacebookDayInsights = {
  spend: number
  impressions: number
  clicks: number
}

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('act_')) return trimmed
  return `act_${trimmed}`
}

export async function fetchFacebookDayInsights(args: {
  date: string // YYYY-MM-DD
  accessToken: string
  adAccountId: string
}): Promise<FacebookDayInsights> {
  const account = normalizeAdAccountId(args.adAccountId)
  const timeRange = JSON.stringify({ since: args.date, until: args.date })
  const url = new URL(`https://graph.facebook.com/v21.0/${account}/insights`)
  url.searchParams.set('fields', 'spend,impressions,clicks')
  url.searchParams.set('time_range', timeRange)
  url.searchParams.set('level', 'account')
  url.searchParams.set('access_token', args.accessToken)

  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    throw new Error(`Facebook Insights API ${res.status}: ${await res.text()}`)
  }

  const body = (await res.json()) as {
    data?: Array<{ spend?: string; impressions?: string; clicks?: string }>
  }
  const row = body.data?.[0]
  return {
    spend: row?.spend != null ? Number(row.spend) : 0,
    impressions: row?.impressions != null ? Number(row.impressions) : 0,
    clicks: row?.clicks != null ? Number(row.clicks) : 0,
  }
}
