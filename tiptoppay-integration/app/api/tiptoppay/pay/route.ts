// app/api/tiptoppay/pay/route.ts
// Pay-уведомление: приходит после КАЖДОГО успешного платежа —
// и установочного (первая оплата через виджет), и каждого рекуррентного списания.
// Это единственный надёжный источник правды об оплате. Не активируйте подписку
// по коллбэку виджета на фронте — только здесь.

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook, parseWebhookBody } from "@/lib/tiptoppay";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyWebhook(rawBody, req.headers.get("Content-HMAC"))) {
    return NextResponse.json({ code: 13 }, { status: 401 });
  }

  const p = parseWebhookBody(rawBody);
  // Ключевые поля:
  // p.TransactionId  — ID транзакции
  // p.Amount         — сумма
  // p.Status         — Completed (для paymentSchema: Single)
  // p.AccountId      — ID вашего пользователя (вы передали его в userInfo.accountId)
  // p.SubscriptionId — ID подписки; есть у рекуррентных списаний и у установочного
  //                    платежа, создавшего подписку
  // p.TestMode       — "1" если тестовый платёж
  // p.Token          — токен карты (можно сохранить для «оплаты по клику»)

  const accountId = p.AccountId;
  const subscriptionId = p.SubscriptionId || null;
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + 1); // месячная подписка

  // TODO: замените на вашу БД (Prisma/Drizzle/SQL):
  // await db.user.update({
  //   where: { id: accountId },
  //   data: {
  //     subscriptionStatus: "active",
  //     subscriptionId,
  //     paidUntil,
  //   },
  // });
  console.log("TipTop Pay: оплата", { accountId, subscriptionId, amount: p.Amount, paidUntil });

  // Обязательный ответ — иначе TipTop Pay будет слать уведомление повторно
  return NextResponse.json({ code: 0 });
}
