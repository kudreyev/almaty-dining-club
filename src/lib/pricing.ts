/**
 * Единая цена подписки. Менять только через env PRICE / NEXT_PUBLIC_PRICE.
 * Клиент читает NEXT_PUBLIC_PRICE; сервер — PRICE (с fallback на публичный).
 */

function resolvePriceKzt(): number {
  const raw =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_PRICE ?? process.env.PRICE
      : undefined
  const n = raw != null && raw !== '' ? Number(raw) : 1990
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1990
}

/** Цена подписки в тенге (число). */
export const PRICE_KZT = resolvePriceKzt()

/** «1 990 ₸» */
export function formatPriceKzt(amount: number = PRICE_KZT): string {
  return `${amount.toLocaleString('ru-RU')} ₸`
}

/** «1 990 ₸/мес» */
export function formatPricePerMonth(amount: number = PRICE_KZT): string {
  return `${formatPriceKzt(amount)}/мес`
}

/** Ссылка «ваш доступ» в WhatsApp/SMS после оплаты — на главную с каталогом. */
export function getAccessUrl(): string {
  const fromEnv =
    process.env.ACCESS_URL?.trim() || process.env.CABINET_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) return site.replace(/\/$/, '')
  return 'https://kudaclub.kz'
}

/** @deprecated используйте getAccessUrl */
export function getCabinetUrl(): string {
  return getAccessUrl()
}
