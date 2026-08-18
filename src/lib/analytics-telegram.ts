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

/** +1 при новой подписке / реактивации. */
export async function notifySubscriberGained(sub: SubscriberRow): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    const mrr = total * MONTHLY_PRICE_KZT
    const source = attributionLabel(sub)
    const promo = sub.promo_code?.trim()
    const promoPart = promo ? `промокод ${promo}` : 'без промокода'
    await sendTelegramMessage(
      `+1 подписчик (источник: ${source}, ${promoPart}), всего ${fmtNumber(total)}, MRR ${fmtKzt(mrr)}`,
    )
  } catch (error) {
    logServerError('analytics-telegram:gained', error)
  }
}

/** Продление (рекуррентное успешное списание у уже активного). */
export async function notifySubscriptionRenewed(args: {
  amount: number
  source?: string | null
}): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    const source = args.source?.trim() || 'direct'
    await sendTelegramMessage(
      `Продление ${fmtKzt(args.amount)} (источник: ${source}), активных ${fmtNumber(total)}`,
    )
  } catch (error) {
    logServerError('analytics-telegram:renewed', error)
  }
}

/** Использование оффера (успешный staff redeem). */
export async function notifyOfferRedeemed(args: {
  restaurantName: string
  offerTitle?: string | null
}): Promise<void> {
  try {
    const offerPart = args.offerTitle?.trim()
      ? ` · ${args.offerTitle.trim()}`
      : ''
    await sendTelegramMessage(
      `Использование: ${args.restaurantName}${offerPart}`,
    )
  } catch (error) {
    logServerError('analytics-telegram:redeemed', error)
  }
}

/** −1 при отмене. */
export async function notifySubscriberLost(args: {
  reason?: string | null
}): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    const reason = args.reason?.trim()
    const reasonPart = reason ? ` (${reason})` : ''
    await sendTelegramMessage(
      `−1${reasonPart}, всего ${fmtNumber(total)}`,
    )
  } catch (error) {
    logServerError('analytics-telegram:lost', error)
  }
}

export type AdDaySummary = {
  date: string
  newSubs: number
  cancelled: number
  spend: number | null
  paidNew: number
  cac: number | null
}

/** Ежедневная сводка 09:00 Алматы. */
export async function notifyDailyAdSummary(s: AdDaySummary): Promise<void> {
  try {
    const spendStr =
      s.spend == null ? 'н/д' : `${fmtNumber(s.spend)} тг`
    const cacStr =
      s.cac == null ? 'н/д' : `${fmtNumber(s.cac)} тг`
    const flag = s.cac != null && s.cac > 4000 ? ' 🔴' : ''
    await sendTelegramMessage(
      [
        `Сводка за ${s.date} (Алматы)`,
        `Новые: ${s.newSubs}`,
        `Отмены: ${s.cancelled}`,
        `Расход: ${spendStr}`,
        `CAC: ${cacStr}${flag}`,
      ].join('\n'),
    )
  } catch (error) {
    logServerError('analytics-telegram:daily', error)
  }
}
