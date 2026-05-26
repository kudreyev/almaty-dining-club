-- В проде offer_type ограничен CHECK-constraint (offers_offer_type_check).
-- Расширяем допустимые значения для фестивальных офферов Kudafest.

alter table public.offers
  drop constraint if exists offers_offer_type_check;

alter table public.offers
  add constraint offers_offer_type_check
    check (offer_type in ('2for1', 'compliment', 'kudafest_set'));
