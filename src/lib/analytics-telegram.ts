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

/** +1 при новой подписке / реактивации (не на каждый рекуррент). */
export async function notifySubscriberGained(sub: SubscriberRow): Promise<void> {
  try {
    const total = await countActiveSubscribers()
    const mrr = total * MONTHLY_PRICE_KZT
    const source = attributionLabel(sub)
    await sendTelegramMessage(
      `+1 подписчик (источник: ${source}), всего ${fmtNumber(total)}, MRR ${fmtNumber(mrr)} тг`,
    )
  } catch (error) {
    logServerError('analytics-telegram:gained', error)
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
