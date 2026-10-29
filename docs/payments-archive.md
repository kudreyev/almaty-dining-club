# Архив: платная подписка (удалена 29.10.2026)

С 29 октября 2026 г. KudaClub бесплатен для гостей. Платёжный код удалён из
приложения, но полностью сохранён в истории git.

**Последний коммит с рабочей подпиской:** `7794a00` («Закрыть оформление новых подписок»).
Код до закрытия продаж: `cad3cb1`.

Посмотреть или восстановить файл:

```bash
git show 7794a00:src/lib/pricing.ts
git checkout 7794a00 -- src/components/checkout/
```

## Что осталось в проекте

- Вебхуки TipTop (`/api/webhooks/ttp/{pay,recurrent,fail}`, `/api/tiptoppay/{pay,recurrent,refund}`)
  только журналируют событие (`analytics_events.event_name = 'tiptop_webhook_ignored'`)
  и отвечают `{"code":0}`. Подписанный Pay с суммой → алерт в Telegram.
  Общий обработчик: `src/lib/tiptoppay-webhook-log.ts`; проверка HMAC: `src/lib/tiptoppay.ts`.
- Edge Function `supabase/functions/cancel-all-subscriptions` — страховочная отмена
  всех активных подписок в TipTop. Журнал: таблица `subscription_cancel_log`.
- Таблицы `subscriptions`, `subscribers`, `payments`, `payment_requests`,
  `pending_checkouts`, `promo_codes`, `activation_links` не удалялись (история и возвраты).
  Статусы подписок переведены в `cancelled`, прежний статус — в
  `subscriptions.status_before_free`.
- Бывшие плательщики помечены `profiles.is_founder = true` (бейдж «Основатель клуба»).

## Удалённые файлы

### Страницы
- `src/app/pricing/page.tsx`, `src/app/pricing/pricing-faq.tsx`
- `src/app/free/{page,free-checkout,free-how-it-works,free-page-view-tracker,free-venues-logo-grid}.tsx`
  (`/free` теперь редиректит в каталог города через `middleware.ts`)
- `src/app/payment/submit/page.tsx`
- `src/app/activate/{page,actions,activate-card}.tsx`
- `src/app/how-it-works/page.tsx`
- `src/app/app/me/{actions,cancel-subscription-button,me-metrica}.tsx`
- Админка: `src/app/admin/{payments,promo-codes,transfer-subscription,activation-links}/*`

Старые URL (`/pricing`, `/how-it-works`, `/activate`, `/payment/*`, `/checkout/*`)
временно (307) редиректят на `/` — см. `next.config.ts`.

### API
- `src/app/api/checkout/{start,complete}/route.ts`
- `src/app/api/promo/validate/route.ts`
- `src/app/api/me/subscription/route.ts`
- `src/app/api/support/phone-fix/route.ts`
- `src/app/api/webhooks/twilio/message-status/route.ts`

### Компоненты
- `src/components/checkout/{checkout-form,checkout-modal,subscribe-cta}.tsx`
- `src/components/paywall-modal.tsx`, `src/components/offers-panel.tsx`
- `src/components/payment-request-form.tsx`
- `src/components/restaurant/restaurant-subscribe-banner.tsx`
- `src/components/home/{hero-subscriber,trial-upgrade-link,economics-section}.tsx`
- `src/components/sections/final-cta.tsx`
- `src/components/analytics/whatsapp-goal-link.tsx`

### Библиотеки
- `src/lib/pricing.ts`, `src/lib/subscription.ts`, `src/lib/auth/use-user.tsx`
- `src/lib/checkout/*` (create-session, fulfill-pay, otp-actions, otp-rate-limit, pending-checkouts)
- `src/lib/tiptoppay-product.ts`, `src/lib/tiptoppay-ops.ts`
- `src/lib/ttp-analytics-ledger.ts`, `src/lib/ttp-refund-ledger.ts`, `src/lib/ttp-webhook-utils.ts`
- `src/lib/notify-ledger-payment.ts`
- `src/lib/meta-capi.ts`, `src/lib/meta-purchase.ts`
- `src/lib/promo-codes.ts` (+ test)
- `src/lib/activation-links.ts`, `src/lib/activation-links-list.ts` (+ tests)
- `src/lib/messaging/access-messaging.ts` (WhatsApp-шаблон доступа после оплаты)
- `src/lib/whatsapp-analytics.ts` (+ test) — подписная воронка WhatsApp
- `docs/whatsapp-access-template-pwa.md`

## Ручные шаги, которые не делаются кодом

- Отключить шаблон Twilio/Meta `TWILIO_CONTENT_SID_ACCESS` (доступ после оплаты).
- В кабинете TipTop можно оставить URL вебхуков — они безопасны (только журнал).
- Секреты TipTop в Vercel (`TIPTOPPAY_PUBLIC_ID`) больше не нужны;
  `TIPTOPPAY_API_SECRET` оставить, пока TipTop шлёт вебхуки (проверка подписи).
