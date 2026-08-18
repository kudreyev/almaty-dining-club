import { MONTHLY_PRICE_KZT } from '@/lib/metrics-snapshot'
import { sendTelegramMessage } from '@/lib/telegram'
import {
  attributionLabel,
  countActiveSubscribers,
  type SubscriberRow,
} from '@/lib/ttp-analytics-ledger'
import { logServerError } from '@/lib/safe-errors'

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

function fmtKzt(n: number): string {
  return `${fmtNumber(n)} тг`
}

function promoLabel(code: string | null | undefined): string {
  return code?.trim() || 'без промокода'
}

function subscriptionLifetimeDays(
  subscribedAt: string,
  endAt?: string | null,
): number {
  const start = new Date(subscribedAt).getTime()
  const end = endAt ? new Date(endAt).getTime() : Date.now()
  return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)))
}

function formatTopList(
  items: Array<{ label: string; count: number }> | undefined,
  emptyLabel: string,
): string {
  if (!items?.length) return `• ${emptyLabel}`
  return items.map((item) => `• ${item.label}: ${item.count}`).join('\n')
}

/** +1 при новой подписке / реактивации. */
export async function notifySubscriberGained(
  sub: SubscriberRow,
  opts?: { amount?: number; reactivated?: boolean },
): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    const mrr = total * MONTHLY_PRICE_KZT
    const header = opts?.reactivated ? '↩️ Возврат подписчика' : '+1 подписчик'
    const lines = [
      header,
      `Источник: ${attributionLabel(sub)}`,
      `Промокод: ${promoLabel(sub.promo_code)}`,
    ]
    if (opts?.amount != null) {
      lines.push(`Сумма: ${fmtKzt(opts.amount)}`)
    }
    lines.push(`Всего: ${fmtNumber(total)} · MRR ${fmtKzt(mrr)}`)
    await sendTelegramMessage(lines.join('\n'))
  } catch (error) {
    logServerError('analytics-telegram:gained', error)
  }
}

/** Продление (рекуррентное успешное списание у уже активного). */
export async function notifySubscriptionRenewed(args: {
  amount: number
  subscriber: Pick<SubscriberRow, 'utm_source' | 'utm_medium' | 'utm_campaign'>
}): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    await sendTelegramMessage(
      [
        `Продление ${fmtKzt(args.amount)}`,
        `Источник: ${attributionLabel(args.subscriber)}`,
        `Активных: ${fmtNumber(total)}`,
      ].join('\n'),
    )
  } catch (error) {
    logServerError('analytics-telegram:renewed', error)
  }
}

/** Использование оффера (успешный staff redeem). */
export async function notifyOfferRedeemed(args: {
  restaurantName: string
  offerTitle?: string | null
  promoCode?: string | null
}): Promise<void> {
  try {
    const lines = [
      '🍽 Использование',
      `Заведение: ${args.restaurantName}`,
    ]
    const offerTitle = args.offerTitle?.trim()
    if (offerTitle) {
      lines.push(`Оффер: ${offerTitle}`)
    }
    lines.push(`Промокод при регистрации: ${promoLabel(args.promoCode)}`)
    await sendTelegramMessage(lines.join('\n'))
  } catch (error) {
    logServerError('analytics-telegram:redeemed', error)
  }
}

/** −1 при отмене. */
export async function notifySubscriberLost(args: {
  reason?: string | null
  subscriber?: SubscriberRow | null
}): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    const reason = args.reason?.trim()
    const sub = args.subscriber

    if (!sub) {
      const reasonPart = reason ? ` (${reason})` : ''
      await sendTelegramMessage(`−1${reasonPart}, всего ${fmtNumber(total)}`)
      return
    }

    const reasonPart = reason ? ` (причина: ${reason})` : ''
    const days = subscriptionLifetimeDays(sub.subscribed_at, sub.cancelled_at)
    await sendTelegramMessage(
      [
        `−1 подписчик${reasonPart}`,
        `Источник: ${attributionLabel(sub)}`,
        `Промокод: ${promoLabel(sub.promo_code)}`,
        `Был в подписке: ${days} дн.`,
        `Всего: ${fmtNumber(total)}`,
      ].join('\n'),
    )
  } catch (error) {
    logServerError('analytics-telegram:lost', error)
  }
}

export type AdDayTopItem = { label: string; count: number }

export type AdDaySummary = {
  date: string
  newSubs: number
  cancelled: number
  spend: number | null
  paidNew: number
  cac: number | null
  topSources?: AdDayTopItem[]
  topPromos?: AdDayTopItem[]
  redemptions?: number
}

/** Ежедневная сводка 09:00 Алматы. */
export async function notifyDailyAdSummary(s: AdDaySummary): Promise<void> {
  try {
    const spendStr = s.spend == null ? 'н/д' : `${fmtNumber(s.spend)} тг`
    const cacStr = s.cac == null ? 'н/д' : `${fmtNumber(s.cac)} тг`
    const flag = s.cac != null && s.cac > 4000 ? ' 🔴' : ''
    const net = s.newSubs - s.cancelled
    const netSign = net > 0 ? '+' : ''

    await sendTelegramMessage(
      [
        `📊 Сводка за ${s.date} (Алматы)`,
        '',
        `Новые: ${s.newSubs} · Отмены: ${s.cancelled} · Чистый: ${netSign}${net}`,
        `Расход: ${spendStr} · CAC: ${cacStr}${flag}`,
        '',
        'Топ источники:',
        formatTopList(s.topSources, 'нет данных'),
        '',
        'Топ промокоды (новые):',
        formatTopList(s.topPromos, 'нет данных'),
        '',
        `Использования офферов: ${s.redemptions ?? 0}`,
      ].join('\n'),
    )
  } catch (error) {
    logServerError('analytics-telegram:daily', error)
  }
}

/** Агрегация топ-N источников для daily digest. */
export function aggregateTopSources(
  rows: Array<{ utm_source: string | null; utm_medium: string | null }>,
  limit = 3,
): AdDayTopItem[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const source = row.utm_source?.trim() || 'direct'
    const medium = row.utm_medium?.trim()
    const label = medium ? `${source}/${medium}` : source
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

/** Агрегация топ-N промокодов для daily digest. */
export function aggregateTopPromos(
  rows: Array<{ promo_code: string | null }>,
  limit = 3,
): AdDayTopItem[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const label = promoLabel(row.promo_code)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}
