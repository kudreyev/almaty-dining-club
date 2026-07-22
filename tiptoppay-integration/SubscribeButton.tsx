"use client";
// components/SubscribeButton.tsx
// Кнопка «Оформить подписку»: открывает виджет TipTop Pay.
// Первый платёж пользователь оплачивает картой, дальше TipTop Pay сам
// списывает 1 990 ₸ ежемесячно (объект recurrent) — свой биллинг не нужен.

import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    tiptop?: { Widget: new () => { start: (p: object) => Promise<any> } };
  }
}

const WIDGET_SRC = "https://widget.tiptoppay.kz/bundles/widget.js";

type Props = {
  userId: string; // ID пользователя в вашей БД — обязателен для подписки
  email: string; // email для квитанций
  amount?: number; // цена подписки, ₸/мес
};

export default function SubscribeButton({ userId, email, amount = 1990 }: Props) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "success" | "fail">("idle");

  useEffect(() => {
    if (window.tiptop) return setReady(true);
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  const pay = useCallback(() => {
    if (!window.tiptop) return;
    setStatus("paying");
    const widget = new window.tiptop.Widget();
    widget
      .start({
        publicTerminalId: process.env.NEXT_PUBLIC_TIPTOPPAY_PUBLIC_ID, // Public ID терминала
        description: "Подписка Kudaclub — 1 месяц",
        amount, // установочный платёж (первый месяц)
        currency: "KZT",
        culture: "ru-RU",
        paymentSchema: "Single", // одностадийная оплата
        externalId: `sub_${userId}_${Date.now()}`, // ваш ID платежа, придёт в вебхуке
        userInfo: {
          accountId: userId, // ОБЯЗАТЕЛЬНО для рекуррента
          email,
        },
        recurrent: {
          period: 1,
          interval: "Month", // списание раз в месяц
          amount, // сумма регулярных списаний
          // startDate не указываем — первое списание через месяц после оплаты
        },
      })
      .then((result: any) => {
        // Финальный статус пользователю показать можно, но доступ открывайте
        // ТОЛЬКО по Pay-вебхуку на сервере — фронту доверять нельзя.
        setStatus(result?.status === "success" ? "success" : "fail");
      })
      .catch(() => setStatus("fail"));
  }, [userId, email, amount]);

  if (status === "success")
    return <p>Оплата прошла! Подписка активируется в течение минуты.</p>;

  return (
    <button onClick={pay} disabled={!ready || status === "paying"}>
      {status === "paying" ? "Открываем оплату…" : `Оформить подписку — ${amount.toLocaleString("ru-RU")} ₸/мес`}
    </button>
  );
}
