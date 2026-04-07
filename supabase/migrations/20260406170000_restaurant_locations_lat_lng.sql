alter table public.restaurant_locations
  add column if not exists lat double precision,
  add column if not exists lng double precision;
