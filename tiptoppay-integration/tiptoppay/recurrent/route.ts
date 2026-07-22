// app/api/tiptoppay/recurrent/route.ts
// Recurrent-уведомление: приходит при изменении статуса подписки.
// Статусы: Active, PastDue (просрочка, идут повторные попытки),
// Cancelled (отменена), Rejected (не удалось списать), Expired (исчерпан maxPeriods).

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, parseWebhookBody } from "@/lib/tiptoppay";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyWebhook(rawBody, req.headers.get("Content-HMAC"))) {
    return NextResponse.json({ code: 13 }, { status: 401 });
  }

  const p = parseWebhookBody(rawBody);
  // Ключевые поля:
  // p.Id                    — ID подписки (= SubscriptionId из Pay-уведомления)
  // p.AccountId             — ID вашего пользователя
  // p.Status                — новый статус подписки
  // p.NextTransactionDate   — дата следующего списания
  // p.SuccessfulTransactionsNumber / p.FailedTransactionsNumber

  const status = p.Status;
  const accountId = p.AccountId;

  if (status === "Cancelled" || status === "Rejected" || status === "Expired") {
    // TODO: закрыть доступ (лучше — по окончании оплаченного периода paidUntil)
    // await db.user.update({ where: { id: accountId }, data: { subscriptionStatus: "inactive" } });
  } else if (status === "PastDue") {
    // TODO: пометить как «проблема с оплатой», можно показать баннер пользователю
  }
  console.log("TipTop Pay: статус подписки", { accountId, subscriptionId: p.Id, status });

  return NextResponse.json({ code: 0 });
}
