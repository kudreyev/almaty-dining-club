-- Расписание использования Kudafest-офферов по дням недели.

create table if not exists public.offer_usable_hours (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  is_unavailable boolean not null default false,
  from_time time null,
  to_time time null,
  created_at timestamptz not null default now(),
  constraint offer_usable_hours_offer_day_uidx unique (offer_id, day_of_week),
  check (
    (is_unavailable = true and from_time is null and to_time is null)
    or (
      is_unavailable = false
      and from_time is not null
      and to_time is not null
      and from_time < to_time
    )
  )
);

create index if not exists offer_usable_hours_offer_day_idx
  on public.offer_usable_hours (offer_id, day_of_week);

alter table public.offer_usable_hours enable row level security;

drop policy if exists "offer_usable_hours_public_active_offers" on public.offer_usable_hours;
create policy "offer_usable_hours_public_active_offers"
  on public.offer_usable_hours
  for select
  to public
  using (
    exists (
      select 1
      from public.offers o
      join public.restaurants r on r.id = o.restaurant_id
      where o.id = offer_usable_hours.offer_id
        and o.is_active = true
        and r.is_active = true
    )
  );

drop policy if exists "offer_usable_hours_admin_all" on public.offer_usable_hours;
create policy "offer_usable_hours_admin_all"
  on public.offer_usable_hours
  for all
  to authenticated
  using (public.is_profile_admin())
  with check (public.is_profile_admin());

-- Перенос из одного окна (если миграция 20260605120000 уже применена).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offers'
      and column_name = 'usable_from_time'
  ) then
    insert into public.offer_usable_hours (offer_id, day_of_week, is_unavailable, from_time, to_time)
    select o.id, d.day, false, o.usable_from_time, o.usable_to_time
    from public.offers o
    cross join generate_series(1, 7) as d(day)
    where o.usable_from_time is not null
      and o.usable_to_time is not null
    on conflict (offer_id, day_of_week) do nothing;

    alter table public.offers drop constraint if exists offers_usable_hours_pair_check;
    alter table public.offers drop constraint if exists offers_usable_hours_order_check;
    alter table public.offers drop column if exists usable_from_time;
    alter table public.offers drop column if exists usable_to_time;
  end if;
end $$;
