-- Фестивали (KudaFest / BreakFest / …): events, сеты, расписание подачи,
-- раздельные лимиты, combine-окно с клубными офферами.

-- ---------------------------------------------------------------------------
-- 1) events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  city public.city not null default 'almaty',
  starts_at date not null,
  ends_at date not null,
  set_price_kzt integer not null check (set_price_kzt >= 0),
  logo_url text,
  accent_color text not null default '#5B21B6',
  is_published boolean not null default false,
  max_sets_per_venue_per_day integer not null default 1
    check (max_sets_per_venue_per_day >= 1),
  created_at timestamptz not null default now(),
  constraint events_slug_uidx unique (slug),
  constraint events_dates_check check (ends_at >= starts_at)
);

create index if not exists events_city_published_dates_idx
  on public.events (city, is_published, starts_at, ends_at);

alter table public.events enable row level security;

drop policy if exists "events_public_read_published" on public.events;
create policy "events_public_read_published"
  on public.events
  for select
  using (is_published = true);

drop policy if exists "events_admin_all" on public.events;
create policy "events_admin_all"
  on public.events
  for all
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) restaurants.combine_set_with_club_offer
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists combine_set_with_club_offer boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3) offers: set fields + rename kudafest_set → set
-- ---------------------------------------------------------------------------
alter table public.offers
  add column if not exists event_id uuid references public.events (id) on delete restrict,
  add column if not exists price_kzt integer check (price_kzt is null or price_kzt >= 0),
  add column if not exists items jsonb,
  add column if not exists menu_value_kzt integer check (menu_value_kzt is null or menu_value_kzt >= 0);

create index if not exists offers_event_id_idx on public.offers (event_id)
  where event_id is not null;

-- Temporarily allow both kudafest_set and set while we backfill event_id.
alter table public.offers
  drop constraint if exists offers_offer_type_check;

alter table public.offers
  add constraint offers_offer_type_check
    check (offer_type in ('2for1', 'compliment', 'kudafest_set', 'set'));

-- ---------------------------------------------------------------------------
-- 4) event_venue_schedule
-- ---------------------------------------------------------------------------
create table if not exists public.event_venue_schedule (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  offer_id uuid references public.offers (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  open_time time not null,
  close_time time not null,
  created_at timestamptz not null default now()
);

create index if not exists event_venue_schedule_lookup_idx
  on public.event_venue_schedule (event_id, restaurant_id, weekday);

create index if not exists event_venue_schedule_offer_idx
  on public.event_venue_schedule (offer_id, weekday)
  where offer_id is not null;

alter table public.event_venue_schedule enable row level security;

drop policy if exists "event_venue_schedule_public_read" on public.event_venue_schedule;
create policy "event_venue_schedule_public_read"
  on public.event_venue_schedule
  for select
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_venue_schedule.event_id
        and e.is_published = true
    )
  );

drop policy if exists "event_venue_schedule_admin_all" on public.event_venue_schedule;
create policy "event_venue_schedule_admin_all"
  on public.event_venue_schedule
  for all
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5) Denormalize offer_type / event_id on tokens & redemptions
-- ---------------------------------------------------------------------------
alter table public.redeem_tokens
  add column if not exists offer_type text,
  add column if not exists event_id uuid references public.events (id) on delete set null;

alter table public.redemptions
  add column if not exists offer_type text,
  add column if not exists event_id uuid references public.events (id) on delete set null;

update public.redeem_tokens t
set
  offer_type = o.offer_type,
  event_id = o.event_id
from public.offers o
where o.id = t.offer_id
  and (t.offer_type is null or t.offer_type is distinct from o.offer_type);

update public.redemptions r
set
  offer_type = coalesce(t.offer_type, o.offer_type),
  event_id = coalesce(t.event_id, o.event_id)
from public.redeem_tokens t
join public.offers o on o.id = t.offer_id
where t.id = r.redeem_token_id
  and r.offer_type is null;

create index if not exists redeem_tokens_event_id_idx
  on public.redeem_tokens (event_id)
  where event_id is not null;

create index if not exists redemptions_event_type_idx
  on public.redemptions (event_id, offer_type, redeemed_at desc);

-- ---------------------------------------------------------------------------
-- 6) Migrate existing kudafest sets into events + schedule
-- ---------------------------------------------------------------------------
do $$
declare
  v_event_id uuid;
  v_city public.city;
  v_ends date;
  v_starts date;
  v_slug text;
  v_price int;
begin
  for v_city in
    select distinct r.city
    from public.offers o
    join public.restaurants r on r.id = o.restaurant_id
    where o.offer_type in ('kudafest_set', 'set')
      and o.event_id is null
  loop
    select
      coalesce(max(o.end_date), (now() at time zone 'Asia/Almaty')::date + 30),
      coalesce(
        min(o.end_date) filter (where o.end_date is not null),
        (now() at time zone 'Asia/Almaty')::date - 7
      )
    into v_ends, v_starts
    from public.offers o
    join public.restaurants r on r.id = o.restaurant_id
    where o.offer_type in ('kudafest_set', 'set')
      and o.event_id is null
      and r.city = v_city;

    if v_starts is null then
      v_starts := v_ends - 30;
    end if;
    if v_starts > v_ends then
      v_starts := v_ends - 30;
    end if;

    v_slug := case
      when v_city = 'astana' then 'kudafest-astana'
      else 'kudafest'
    end;

    v_price := 4000;

    insert into public.events (
      slug, name, city, starts_at, ends_at, set_price_kzt,
      accent_color, is_published, max_sets_per_venue_per_day
    )
    values (
      v_slug,
      'KudaFest',
      v_city,
      v_starts,
      v_ends,
      v_price,
      '#5B21B6',
      true,
      1
    )
    on conflict (slug) do update
      set ends_at = greatest(public.events.ends_at, excluded.ends_at),
          starts_at = least(public.events.starts_at, excluded.starts_at),
          is_published = true
    returning id into v_event_id;

    if v_event_id is null then
      select id into v_event_id from public.events where slug = v_slug;
    end if;

    update public.offers o
    set
      offer_type = 'set',
      event_id = v_event_id,
      price_kzt = coalesce(o.price_kzt, v_price),
      menu_value_kzt = coalesce(
        o.menu_value_kzt,
        case
          when o.estimated_value is not null
            then o.estimated_value + coalesce(o.price_kzt, v_price)
          else coalesce(o.price_kzt, v_price) + 2000
        end
      ),
      estimated_value = coalesce(
        o.estimated_value,
        greatest(
          0,
          coalesce(o.menu_value_kzt, coalesce(o.price_kzt, v_price) + 2000)
            - coalesce(o.price_kzt, v_price)
        )
      )
    from public.restaurants r
    where o.restaurant_id = r.id
      and r.city = v_city
      and o.offer_type in ('kudafest_set', 'set')
      and o.event_id is null;

    insert into public.event_venue_schedule (
      event_id, restaurant_id, offer_id, weekday, open_time, close_time
    )
    select distinct on (o.restaurant_id, h.day_of_week, h.from_time, h.to_time)
      v_event_id,
      o.restaurant_id,
      null::uuid,
      h.day_of_week,
      h.from_time,
      case
        when h.to_next_day then time '00:00'
        else h.to_time
      end
    from public.offers o
    join public.offer_usable_hours h on h.offer_id = o.id
    join public.restaurants r on r.id = o.restaurant_id
    where o.offer_type = 'set'
      and o.event_id = v_event_id
      and r.city = v_city
      and h.is_unavailable = false
      and h.from_time is not null
      and h.to_time is not null
    order by o.restaurant_id, h.day_of_week, h.from_time, h.to_time;
  end loop;
end
$$;

-- Any leftover kudafest_set without city match → force set + attach to kudafest
update public.offers
set offer_type = 'set'
where offer_type = 'kudafest_set';

-- Recompute estimated_value for sets where menu_value is known.
update public.offers
set estimated_value = greatest(0, menu_value_kzt - coalesce(price_kzt, 0))
where offer_type = 'set'
  and menu_value_kzt is not null
  and price_kzt is not null;

-- Ensure sets that still lack estimated_value get a non-null value.
update public.offers
set
  menu_value_kzt = coalesce(menu_value_kzt, coalesce(price_kzt, 4000) + 2000),
  price_kzt = coalesce(price_kzt, 4000),
  estimated_value = greatest(
    0,
    coalesce(menu_value_kzt, coalesce(price_kzt, 4000) + 2000)
      - coalesce(price_kzt, 4000)
  )
where offer_type = 'set'
  and (estimated_value is null or menu_value_kzt is null or price_kzt is null);

-- Orphan sets without event: create a fallback event and attach.
do $$
declare
  v_event_id uuid;
begin
  if exists (select 1 from public.offers where offer_type = 'set' and event_id is null) then
    insert into public.events (
      slug, name, city, starts_at, ends_at, set_price_kzt, is_published
    )
    values (
      'kudafest-legacy',
      'KudaFest',
      'almaty',
      (now() at time zone 'Asia/Almaty')::date - 7,
      (now() at time zone 'Asia/Almaty')::date + 30,
      4000,
      true
    )
    on conflict (slug) do update set is_published = true
    returning id into v_event_id;

    if v_event_id is null then
      select id into v_event_id from public.events where slug = 'kudafest-legacy';
    end if;

    update public.offers
    set event_id = v_event_id
    where offer_type = 'set' and event_id is null;
  end if;
end
$$;

alter table public.offers
  drop constraint if exists offers_offer_type_check;

alter table public.offers
  add constraint offers_offer_type_check
    check (offer_type in ('2for1', 'compliment', 'set'));

alter table public.offers
  drop constraint if exists offers_set_event_required;

alter table public.offers
  add constraint offers_set_event_required
    check (
      (offer_type = 'set' and event_id is not null)
      or (offer_type <> 'set' and event_id is null)
    );

-- ---------------------------------------------------------------------------
-- 7) Helpers: event active, schedule window, club partner
-- ---------------------------------------------------------------------------
create or replace function public.event_is_active_now(
  p_event_id uuid,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.is_published = true
      and (p_now at time zone 'Asia/Almaty')::date between e.starts_at and e.ends_at
  );
$$;

create or replace function public.restaurant_is_club_partner(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.offers o
    where o.restaurant_id = p_restaurant_id
      and o.is_active = true
      and o.event_id is null
      and o.offer_type in ('2for1', 'compliment')
  );
$$;

-- Time window match for event_venue_schedule (close_time 00:00 = end of day).
create or replace function public.event_schedule_covers_local_time(
  p_open time,
  p_close time,
  p_tod time
)
returns boolean
language sql
immutable
as $$
  select case
    when p_close = time '00:00' then p_tod >= p_open
    when p_close > p_open then p_tod >= p_open and p_tod < p_close
    -- overnight window ending next calendar day before close
    else p_tod >= p_open or p_tod < p_close
  end;
$$;

create or replace function public.offer_is_usable_now(
  p_offer_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_offer record;
  v_dow int;
  v_prev_dow int;
  v_tod time;
  v_has_offer_sched boolean;
  v_has_venue_sched boolean;
begin
  select
    o.id,
    o.offer_type,
    o.event_id,
    o.restaurant_id,
    o.is_active,
    o.end_date
  into v_offer
  from public.offers o
  where o.id = p_offer_id;

  if not found or not v_offer.is_active then
    return false;
  end if;

  v_dow := extract(isodow from p_now at time zone 'Asia/Almaty')::int;
  v_prev_dow := ((v_dow + 5) % 7) + 1;
  v_tod := (p_now at time zone 'Asia/Almaty')::time;

  if v_offer.offer_type = 'set' then
    if v_offer.event_id is null
       or not public.event_is_active_now(v_offer.event_id, p_now) then
      return false;
    end if;

    select exists (
      select 1
      from public.event_venue_schedule s
      where s.event_id = v_offer.event_id
        and s.restaurant_id = v_offer.restaurant_id
        and s.offer_id = v_offer.id
    ) into v_has_offer_sched;

    if v_has_offer_sched then
      return exists (
        select 1
        from public.event_venue_schedule s
        where s.event_id = v_offer.event_id
          and s.restaurant_id = v_offer.restaurant_id
          and s.offer_id = v_offer.id
          and (
            (
              s.weekday = v_dow
              and public.event_schedule_covers_local_time(s.open_time, s.close_time, v_tod)
            )
            or (
              s.weekday = v_prev_dow
              and s.close_time <> time '00:00'
              and s.close_time <= s.open_time
              and v_tod < s.close_time
            )
          )
      );
    end if;

    select exists (
      select 1
      from public.event_venue_schedule s
      where s.event_id = v_offer.event_id
        and s.restaurant_id = v_offer.restaurant_id
        and s.offer_id is null
    ) into v_has_venue_sched;

    if not v_has_venue_sched then
      return false;
    end if;

    return exists (
      select 1
      from public.event_venue_schedule s
      where s.event_id = v_offer.event_id
        and s.restaurant_id = v_offer.restaurant_id
        and s.offer_id is null
        and (
          (
            s.weekday = v_dow
            and public.event_schedule_covers_local_time(s.open_time, s.close_time, v_tod)
          )
          or (
            s.weekday = v_prev_dow
            and s.close_time <> time '00:00'
            and s.close_time <= s.open_time
            and v_tod < s.close_time
          )
        )
    );
  end if;

  -- Club offers: end_date + offer_usable_hours (empty = always ok).
  if v_offer.end_date is not null
     and v_offer.end_date < (p_now at time zone 'Asia/Almaty')::date then
    return false;
  end if;

  return (
    not exists (
      select 1
      from public.offer_usable_hours h
      where h.offer_id = p_offer_id
        and h.is_unavailable = false
        and h.from_time is not null
        and h.to_time is not null
    )
    or exists (
      select 1
      from public.offer_usable_hours s
      where s.offer_id = p_offer_id
        and s.is_unavailable = false
        and s.from_time is not null
        and s.to_time is not null
        and (
          (
            s.day_of_week = v_dow
            and v_tod >= s.from_time
            and (s.to_next_day or v_tod < s.to_time)
          )
          or (
            s.day_of_week = v_prev_dow
            and s.to_next_day
            and v_tod < s.to_time
          )
        )
    )
  );
end;
$$;

-- Alias requested in product spec.
create or replace function public.offer_available_now(
  p_offer_id uuid,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.offer_is_usable_now(p_offer_id, p_now);
$$;

revoke all on function public.event_is_active_now(uuid, timestamptz) from public;
revoke all on function public.restaurant_is_club_partner(uuid) from public;
revoke all on function public.offer_is_usable_now(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.offer_available_now(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.event_is_active_now(uuid, timestamptz) to anon, authenticated, service_role;
grant execute on function public.restaurant_is_club_partner(uuid) to anon, authenticated, service_role;
grant execute on function public.offer_is_usable_now(uuid, timestamptz) to service_role;
grant execute on function public.offer_available_now(uuid, timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8) issue_redeem_token — sets, combine window, denorm fields
-- ---------------------------------------------------------------------------
create or replace function public.issue_redeem_token(
  p_restaurant_id uuid,
  p_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_offer record;
  v_active record;
  v_code text;
  v_token_id uuid;
  v_expires_at timestamptz;
  v_attempt int := 0;
  v_today date;
  v_set_count int;
  v_max_sets int;
  v_combine boolean;
  v_is_set boolean;
  v_blocked boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and nullif(btrim(p.phone), '') is not null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'phone_not_verified');
  end if;

  select
    o.id,
    o.offer_type,
    o.event_id,
    o.end_date,
    o.is_active,
    r.is_active as restaurant_active,
    r.combine_set_with_club_offer,
    e.max_sets_per_venue_per_day,
    e.is_published as event_published,
    e.starts_at as event_starts,
    e.ends_at as event_ends
  into v_offer
  from public.offers o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.events e on e.id = o.event_id
  where o.id = p_offer_id
    and o.restaurant_id = p_restaurant_id;

  if not found
     or not v_offer.is_active
     or not v_offer.restaurant_active then
    return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  end if;

  v_today := (v_now at time zone 'Asia/Almaty')::date;
  v_is_set := v_offer.offer_type = 'set';

  if v_is_set then
    if v_offer.event_id is null
       or not coalesce(v_offer.event_published, false)
       or v_today < v_offer.event_starts
       or v_today > v_offer.event_ends then
      return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
    end if;
  elsif v_offer.end_date is not null and v_offer.end_date < v_today then
    return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  end if;

  -- Один гость не получит два кода параллельно.
  perform pg_advisory_xact_lock(hashtextextended('kuda_redeem_user:' || v_user_id::text, 0));

  select t.id, t.offer_id, t.expires_at
  into v_active
  from public.redeem_tokens t
  where t.user_id = v_user_id
    and t.status = 'active'
    and t.used_at is null
    and t.expires_at > v_now
  order by t.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'active_token',
      'token_id', v_active.id,
      'offer_id', v_active.offer_id,
      'expires_at', v_active.expires_at
    );
  end if;

  if not public.offer_is_usable_now(p_offer_id, v_now) then
    return jsonb_build_object('ok', false, 'reason', 'usable_hours');
  end if;

  -- Combine window: set ↔ club within 3 hours at same venue.
  v_combine := coalesce(v_offer.combine_set_with_club_offer, false);
  if not v_combine then
    if v_is_set then
      select exists (
        select 1
        from public.redemptions r
        where r.user_id = v_user_id
          and r.restaurant_id = p_restaurant_id
          and r.redeemed_at > v_now - interval '3 hours'
          and coalesce(r.offer_type, '') in ('2for1', 'compliment')
      ) into v_blocked;
    else
      select exists (
        select 1
        from public.redemptions r
        where r.user_id = v_user_id
          and r.restaurant_id = p_restaurant_id
          and r.redeemed_at > v_now - interval '3 hours'
          and coalesce(r.offer_type, '') = 'set'
      ) into v_blocked;
    end if;

    if v_blocked then
      return jsonb_build_object('ok', false, 'reason', 'combine_blocked');
    end if;
  end if;

  -- Set daily limit per guest per venue (does not touch club limits).
  if v_is_set then
    v_max_sets := coalesce(v_offer.max_sets_per_venue_per_day, 1);
    select count(*)::int
    into v_set_count
    from public.redemptions r
    where r.user_id = v_user_id
      and r.restaurant_id = p_restaurant_id
      and r.event_id = v_offer.event_id
      and coalesce(r.offer_type, 'set') = 'set'
      and (r.redeemed_at at time zone 'Asia/Almaty')::date = v_today;

    if v_set_count >= v_max_sets then
      return jsonb_build_object('ok', false, 'reason', 'set_daily_limit');
    end if;
  end if;

  v_expires_at := v_now + interval '10 minutes';

  loop
    v_attempt := v_attempt + 1;
    v_code := (
      ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint
      % 900000 + 100000
    )::text;

    begin
      insert into public.redeem_tokens (
        user_id,
        restaurant_id,
        offer_id,
        offer_type,
        event_id,
        token_code,
        status,
        issued_at,
        expires_at,
        extend_deadline_at,
        extended_once,
        used_at
      )
      values (
        v_user_id,
        p_restaurant_id,
        p_offer_id,
        v_offer.offer_type,
        v_offer.event_id,
        v_code,
        'active',
        v_now,
        v_expires_at,
        v_now + interval '1 hour',
        false,
        null
      )
      returning id into v_token_id;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 20 then
          return jsonb_build_object('ok', false, 'reason', 'server_error');
        end if;
    end;
  end loop;

  insert into public.analytics_events (event_name, user_id, meta)
  values (
    'code_requested',
    v_user_id,
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'offer_id', p_offer_id,
      'token_id', v_token_id,
      'offer_type', v_offer.offer_type,
      'event_id', v_offer.event_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'token_id', v_token_id,
    'token_code', v_code,
    'expires_at', v_expires_at
  );
end;
$$;

comment on function public.issue_redeem_token(uuid, uuid) is
  'Выдаёт код: телефон, один активный код, окно подачи; для сетов — лимит/день и combine.';

-- ---------------------------------------------------------------------------
-- 9) redeem_token_atomic — set window check + denorm on redemption
-- ---------------------------------------------------------------------------
create or replace function public.redeem_token_atomic(
  p_token_code text,
  p_restaurant_id uuid,
  p_staff_user_id uuid,
  p_idempotency_window_seconds int default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.redeem_tokens%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_redeemed_at timestamptz;
  v_redemption_id uuid;
  v_window interval;
  v_offer_type text;
  v_event_id uuid;
begin
  v_window := make_interval(secs => greatest(p_idempotency_window_seconds, 0));

  select *
  into v_token
  from public.redeem_tokens
  where token_code = p_token_code
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_token.used_at is not null or v_token.status <> 'active' then
    if v_token.status = 'redeemed' and v_token.used_at is not null then
      if v_token.used_at >= v_now - v_window then
        select r.id
        into v_redemption_id
        from public.redemptions r
        where r.redeem_token_id = v_token.id
        limit 1;

        return jsonb_build_object(
          'ok', true,
          'idempotent', true,
          'token_id', v_token.id,
          'redemption_id', v_redemption_id
        );
      end if;

      return jsonb_build_object('ok', false, 'reason', 'already_used');
    end if;

    if v_token.status = 'expired' then
      return jsonb_build_object('ok', false, 'reason', 'expired');
    end if;

    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  if v_token.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- Resolve type/event (prefer denorm, fallback to offer).
  select
    coalesce(v_token.offer_type, o.offer_type),
    coalesce(v_token.event_id, o.event_id)
  into v_offer_type, v_event_id
  from public.offers o
  where o.id = v_token.offer_id;

  if v_offer_type is null then
    return jsonb_build_object('ok', false, 'reason', 'server_error');
  end if;

  -- Sets cannot be redeemed outside serving window.
  if v_offer_type = 'set'
     and not public.offer_is_usable_now(v_token.offer_id, v_now) then
    return jsonb_build_object('ok', false, 'reason', 'usable_hours');
  end if;

  v_redeemed_at := v_now;

  update public.redeem_tokens
  set
    status = 'redeemed',
    used_at = v_redeemed_at,
    redeemed_at = v_redeemed_at,
    redeemed_by_staff_id = p_staff_user_id,
    offer_type = coalesce(offer_type, v_offer_type),
    event_id = coalesce(event_id, v_event_id)
  where id = v_token.id
    and status = 'active'
    and used_at is null;

  if not found then
    select *
    into v_token
    from public.redeem_tokens
    where id = v_token.id;

    if v_token.status = 'redeemed'
       and v_token.used_at is not null
       and v_token.used_at >= v_now - v_window then
      select r.id
      into v_redemption_id
      from public.redemptions r
      where r.redeem_token_id = v_token.id
      limit 1;

      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'token_id', v_token.id,
        'redemption_id', v_redemption_id
      );
    end if;

    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  insert into public.redemptions (
    user_id,
    restaurant_id,
    offer_id,
    redeem_token_id,
    staff_user_id,
    redeemed_at,
    offer_type,
    event_id
  )
  values (
    v_token.user_id,
    v_token.restaurant_id,
    v_token.offer_id,
    v_token.id,
    p_staff_user_id,
    v_redeemed_at,
    v_offer_type,
    v_event_id
  )
  on conflict (redeem_token_id) do nothing
  returning id into v_redemption_id;

  if v_redemption_id is null then
    select r.id
    into v_redemption_id
    from public.redemptions r
    where r.redeem_token_id = v_token.id
    limit 1;

    if v_redemption_id is not null then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'token_id', v_token.id,
        'redemption_id', v_redemption_id
      );
    end if;

    raise exception 'redemption_insert_miss';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'token_id', v_token.id,
    'redemption_id', v_redemption_id,
    'offer_type', v_offer_type,
    'event_id', v_event_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'reason', 'server_error');
end;
$$;

revoke all on function public.redeem_token_atomic(text, uuid, uuid, int) from public;
grant execute on function public.redeem_token_atomic(text, uuid, uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- 10) Seed test festival for verification (today, Almaty)
-- ---------------------------------------------------------------------------
do $$
declare
  v_event_id uuid;
  v_rest_a uuid;
  v_rest_b uuid;
  v_offer_club uuid;
  v_offer_set_a uuid;
  v_offer_set_b uuid;
  v_today date := (now() at time zone 'Asia/Almaty')::date;
  v_dow int;
begin
  insert into public.events (
    slug, name, city, starts_at, ends_at, set_price_kzt,
    accent_color, is_published, max_sets_per_venue_per_day
  )
  values (
    'testfest-today',
    'TestFest',
    'almaty',
    v_today,
    v_today + 14,
    3500,
    '#0F766E',
    true,
    1
  )
  on conflict (slug) do update
    set starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        set_price_kzt = excluded.set_price_kzt,
        accent_color = excluded.accent_color,
        is_published = true,
        name = excluded.name
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.events where slug = 'testfest-today';
  end if;

  -- Venue A: club 1+1 + set
  -- is_active=false: сид не светится гостям в каталоге; админы смотрят в превью.
  insert into public.restaurants (
    restaurant_name, slug, city, address, cuisine, is_active,
    combine_set_with_club_offer
  )
  values (
    'TestFest Café A',
    'testfest-cafe-a',
    'almaty',
    'Тестовая 1',
    'Кофейня',
    false,
    false
  )
  on conflict (slug) do update
    set restaurant_name = excluded.restaurant_name,
        is_active = false,
        combine_set_with_club_offer = false
  returning id into v_rest_a;

  if v_rest_a is null then
    select id into v_rest_a from public.restaurants where slug = 'testfest-cafe-a';
  end if;

  insert into public.offers (
    restaurant_id, offer_type, offer_key, offer_title,
    offer_terms_short, offer_terms_full, estimated_value, is_active
  )
  values (
    v_rest_a, '2for1', 'testfest-a-club', 'Капучино',
    'Второй капучино бесплатно', '', 1500, true
  )
  on conflict (restaurant_id, offer_key) do update
    set is_active = true,
        offer_title = excluded.offer_title
  returning id into v_offer_club;

  insert into public.offers (
    restaurant_id, offer_type, offer_key, offer_title,
    offer_terms_short, offer_terms_full, event_id, price_kzt, menu_value_kzt,
    estimated_value, items, is_active
  )
  values (
    v_rest_a, 'set', 'testfest-a-set', 'Сет №1',
    'Завтрак-сет TestFest', '',
    v_event_id, 3500, 6500, 3000,
    '[{"title":"Тост с авокадо"},{"title":"Десерт на выбор","options":["круассан","маффин"]},{"title":"Напиток на выбор","options":["латте","капучино"]}]'::jsonb,
    true
  )
  on conflict (restaurant_id, offer_key) do update
    set is_active = true,
        event_id = excluded.event_id,
        price_kzt = excluded.price_kzt,
        menu_value_kzt = excluded.menu_value_kzt,
        estimated_value = excluded.estimated_value,
        items = excluded.items
  returning id into v_offer_set_a;

  -- Venue B: set only
  insert into public.restaurants (
    restaurant_name, slug, city, address, cuisine, is_active,
    combine_set_with_club_offer
  )
  values (
    'TestFest Café B',
    'testfest-cafe-b',
    'almaty',
    'Тестовая 2',
    'Кофейня',
    false,
    false
  )
  on conflict (slug) do update
    set restaurant_name = excluded.restaurant_name,
        is_active = false
  returning id into v_rest_b;

  if v_rest_b is null then
    select id into v_rest_b from public.restaurants where slug = 'testfest-cafe-b';
  end if;

  insert into public.offers (
    restaurant_id, offer_type, offer_key, offer_title,
    offer_terms_short, offer_terms_full, event_id, price_kzt, menu_value_kzt,
    estimated_value, items, is_active
  )
  values (
    v_rest_b, 'set', 'testfest-b-set', 'Сет №1',
    'Сет только на буднях', '',
    v_event_id, 3500, 7000, 3500,
    '[{"title":"Скрэмбл"},{"title":"Сок"}]'::jsonb,
    true
  )
  on conflict (restaurant_id, offer_key) do update
    set is_active = true,
        event_id = excluded.event_id,
        price_kzt = excluded.price_kzt,
        menu_value_kzt = excluded.menu_value_kzt,
        estimated_value = excluded.estimated_value,
        items = excluded.items
  returning id into v_offer_set_b;

  -- Clear & seed schedule for A: mon–fri 08–12, sat–sun 09–14
  delete from public.event_venue_schedule
  where event_id = v_event_id
    and restaurant_id in (v_rest_a, v_rest_b);

  for v_dow in 1..5 loop
    insert into public.event_venue_schedule (
      event_id, restaurant_id, offer_id, weekday, open_time, close_time
    ) values (v_event_id, v_rest_a, null, v_dow, '08:00', '12:00');
  end loop;
  for v_dow in 6..7 loop
    insert into public.event_venue_schedule (
      event_id, restaurant_id, offer_id, weekday, open_time, close_time
    ) values (v_event_id, v_rest_a, null, v_dow, '09:00', '14:00');
  end loop;

  -- B: weekdays only 08–12
  for v_dow in 1..5 loop
    insert into public.event_venue_schedule (
      event_id, restaurant_id, offer_id, weekday, open_time, close_time
    ) values (v_event_id, v_rest_b, null, v_dow, '08:00', '12:00');
  end loop;

  -- Staff PIN for A (for redeem tests)
  insert into public.staff_users (restaurant_id, staff_name, pin_code, is_active)
  select v_rest_a, 'TestFest Staff', '1234', true
  where not exists (
    select 1 from public.staff_users s
    where s.restaurant_id = v_rest_a and s.pin_code = '1234'
  );
end
$$;
