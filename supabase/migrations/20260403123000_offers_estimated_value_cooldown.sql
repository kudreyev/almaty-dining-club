alter table public.offers
  add column if not exists estimated_value integer null,
  add column if not exists cooldown_days integer null;
