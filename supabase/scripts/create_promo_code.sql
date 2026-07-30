-- Создание промокода (admin, без UI).
-- Запускать в SQL Editor Supabase или через psql.
--
-- Примеры:
--   50% на первый месяц, без лимита:
--     code = 'HALF50', discount_percent = 50, applies_to = 'first_month'
--   Фиксированная скидка 500 ₸ навсегда, макс 100 использований:
--     code = 'SAVE500', fixed_amount = 500, applies_to = 'forever', max_uses = 100

insert into public.promo_codes (
  code,
  discount_percent,
  fixed_amount,
  applies_to,
  max_uses,
  expires_at,
  campaign_tag,
  is_active
) values (
  'HALF50',          -- код (хранится как есть; поиск регистронезависимый)
  50,                -- процент скидки (XOR с fixed_amount)
  null,              -- скидка в тенге, если не percent
  'first_month',     -- first_month | forever
  null,              -- null = без лимита
  null,              -- null = без срока; иначе timestamptz
  'launch_half',     -- тег кампании для атрибуции
  true
)
on conflict do nothing;

-- Примечание: unique index на lower(code), поэтому on conflict do nothing
-- не сработает напрямую — при повторном запуске будет ошибка unique.
-- Для идемпотентности сначала:
--   delete from public.promo_codes where lower(code) = lower('HALF50');
