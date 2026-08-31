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

/** Минимальная сумма списания в TipTop (комиссия процессинга). */
export const MIN_CHECKOUT_AMOUNT_KZT = 30

/** «1 990 ₸» */
export function formatPriceKzt(amount: number = PRICE_KZT): string {
  return `${amount.toLocaleString('ru-RU')} ₸`
}

/** «1 990 ₸/мес» */
export function formatPricePerMonth(amount: number = PRICE_KZT): string {
  return `${formatPriceKzt(amount)}/мес`
}

/**
 * Текст оффера со скидкой на первый месяц.
 * «Первый месяц 995 ₸, далее 1 990 ₸/мес»
 */
export function formatFirstMonthPromoOffer(
  firstAmount: number,
  recurrentAmount: number = PRICE_KZT,
): string {
  return `Первый месяц ${formatPriceKzt(firstAmount)}, далее ${formatPricePerMonth(recurrentAmount)}`
}

function siteOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) return site.replace(/\/$/, '')
  return 'https://kudaclub.kz'
}

/** Ссылка «ваш доступ» в WhatsApp/SMS после оплаты — на главную с каталогом. */
export function getAccessUrl(): string {
  const fromEnv =
    process.env.ACCESS_URL?.trim() || process.env.CABINET_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return siteOrigin()
}

/**
 * Ссылка на кабинет для строки про установку PWA в WhatsApp-шаблоне.
 * utm — чтобы в Метрике отличать заходы из WA.
 */
export function getPwaInstallInviteUrl(): string {
  return `${siteOrigin()}/app/me?utm_source=whatsapp_pwa`
}

/** @deprecated используйте getAccessUrl */
export function getCabinetUrl(): string {
  return getAccessUrl()
}
