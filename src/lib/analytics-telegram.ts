import { sendTelegramMessage } from '@/lib/telegram'
import { logServerError } from '@/lib/safe-errors'

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

/** Использование оффера (успешный staff redeem). */
export async function notifyOfferRedeemed(args: {
  restaurantName: string
  offerTitle?: string | null
}): Promise<void> {
  try {
    const lines = ['🍽 Использование', `Заведение: ${args.restaurantName}`]
    const offerTitle = args.offerTitle?.trim()
    if (offerTitle) {
      lines.push(`Оффер: ${offerTitle}`)
    }
    await sendTelegramMessage(lines.join('\n'))
  } catch (error) {
    logServerError('analytics-telegram:redeemed', error)
  }
}

export type AdDaySummary = {
  date: string
  signups: number
  codesIssued: number
  redemptions: number
  spend: number | null
  costPerSignup: number | null
}

/** Ежедневная сводка 09:00 Алматы. */
export async function notifyDailyAdSummary(s: AdDaySummary): Promise<void> {
  try {
    const spendStr = s.spend == null ? 'н/д' : `${fmtNumber(s.spend)} тг`
    const cpsStr = s.costPerSignup == null ? 'н/д' : `${fmtNumber(s.costPerSignup)} тг`

    await sendTelegramMessage(
      [
        `📊 Сводка за ${s.date} (Алматы)`,
        '',
        `Регистрации: ${s.signups} · Коды: ${s.codesIssued} · Использования: ${s.redemptions}`,
        `Расход: ${spendStr} · Цена регистрации: ${cpsStr}`,
      ].join('\n'),
    )
  } catch (error) {
    logServerError('analytics-telegram:daily', error)
  }
}
