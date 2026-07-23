-- Новый статус подписки 'cancelled': автосписания остановлены, но доступ
-- сохраняется до конца оплаченного периода (end_date). Отличается от:
--   'active'   — списания продолжаются;
--   'inactive' — доступа нет (период закончился или возврат).
-- Пересоздаём inline-check со статуса (авто-имя subscriptions_status_check).

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('inactive', 'pending_payment', 'active', 'cancelled', 'expired'));
