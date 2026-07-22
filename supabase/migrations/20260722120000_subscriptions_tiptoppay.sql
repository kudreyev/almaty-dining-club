-- TipTop Pay: интеграция подписки.
-- Источник правды об оплате — только серверный Pay-вебхук
-- (src/app/api/tiptoppay/pay/route.ts), не коллбэк виджета на фронте.
--
-- Маппинг требуемых интеграцией полей на существующую схему subscriptions:
--   subscriptionStatus -> subscriptions.status        (уже есть)
--   paidUntil          -> subscriptions.end_date       (уже есть; дата конца доступа)
--   subscriptionId     -> subscriptions.tiptop_subscription_id (новое поле ниже,
--                         ID подписки в TipTop Pay для рекуррента и отмены)
--
-- Существующая логика доступа (isSubscriptionCurrentlyActive) продолжает
-- работать через status + start_date/end_date без изменений.

alter table public.subscriptions
  add column if not exists tiptop_subscription_id text;

-- Быстрый и идемпотентный поиск подписки по её TipTop-идентификатору из вебхуков.
create index if not exists subscriptions_tiptop_subscription_id_idx
  on public.subscriptions (tiptop_subscription_id)
  where tiptop_subscription_id is not null;
