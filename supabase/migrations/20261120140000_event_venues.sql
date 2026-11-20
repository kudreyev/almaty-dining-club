-- Площадки фестиваля отдельно от сетов:
-- сначала event → event_venues, потом offers(type=set) с event_id.

create table if not exists public.event_venues (
  event_id uuid not null references public.events (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, restaurant_id)
);

create index if not exists event_venues_restaurant_idx
  on public.event_venues (restaurant_id);

alter table public.event_venues enable row level security;

drop policy if exists "event_venues_public_read" on public.event_venues;
create policy "event_venues_public_read"
  on public.event_venues
  for select
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_venues.event_id
        and e.is_published = true
    )
  );

drop policy if exists "event_venues_admin_all" on public.event_venues;
create policy "event_venues_admin_all"
  on public.event_venues
  for all
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- Backfill: venues that already have festival sets
insert into public.event_venues (event_id, restaurant_id)
select distinct o.event_id, o.restaurant_id
from public.offers o
where o.offer_type = 'set'
  and o.event_id is not null
on conflict do nothing;

-- Backfill: venues that only have schedule rows
insert into public.event_venues (event_id, restaurant_id)
select distinct s.event_id, s.restaurant_id
from public.event_venue_schedule s
on conflict do nothing;
