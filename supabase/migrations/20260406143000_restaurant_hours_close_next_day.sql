alter table public.restaurant_hours
  add column if not exists close_next_day boolean not null default false;
