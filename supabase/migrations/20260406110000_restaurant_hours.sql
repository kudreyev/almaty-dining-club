create table if not exists public.restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  is_closed boolean not null default false,
  open_time time null,
  close_time time null,
  created_at timestamptz not null default now(),
  check (
    (is_closed = true and open_time is null and close_time is null)
    or (is_closed = false and open_time is not null and close_time is not null)
  )
);

create index if not exists restaurant_hours_restaurant_day_idx
  on public.restaurant_hours (restaurant_id, day_of_week);

alter table public.restaurant_hours enable row level security;

drop policy if exists "restaurant_hours_public_active_restaurants" on public.restaurant_hours;
create policy "restaurant_hours_public_active_restaurants"
on public.restaurant_hours
for select
to public
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_hours.restaurant_id
      and r.is_active = true
  )
);
