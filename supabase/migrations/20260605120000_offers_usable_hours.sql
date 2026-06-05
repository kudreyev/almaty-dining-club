-- Окно использования для Kudafest-сетов: оффер можно активировать только в заданные часы.

alter table public.offers
  add column if not exists usable_from_time time null,
  add column if not exists usable_to_time time null;

alter table public.offers
  drop constraint if exists offers_usable_hours_pair_check;

alter table public.offers
  add constraint offers_usable_hours_pair_check
    check (
      (usable_from_time is null and usable_to_time is null)
      or (usable_from_time is not null and usable_to_time is not null)
    );

alter table public.offers
  drop constraint if exists offers_usable_hours_order_check;

alter table public.offers
  add constraint offers_usable_hours_order_check
    check (
      usable_from_time is null
      or usable_to_time is null
      or usable_from_time < usable_to_time
    );
