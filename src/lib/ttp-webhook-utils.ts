/** Общие хелперы для TipTop webhook payload. */

export function parseAmount(raw: string | undefined): number {
  if (!raw) return 0
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function parseWebhookJsonData(
  p: Record<string, string>,
): unknown {
  const raw = p.JsonData
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function webhookOk() {
  return { code: 0 as const }
}

export function webhookReject() {
  return { code: 13 as const }
}
