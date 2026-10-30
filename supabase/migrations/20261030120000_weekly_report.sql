-- Еженедельный отчёт KudaClub: агрегаты для Telegram и /admin/report.
-- Погашение = строка в redemptions (персонал подтвердил код на /staff).
-- Неделя = пн 00:00 — вс 23:59 Asia/Almaty. Без телефонов, имён и id гостей.

-- ---------------------------------------------------------------------------
-- Attribution на профиле (старые строки остаются null)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists utm_source text,
  add column if not exists utm_campaign text,
  add column if not exists ref_code text;

-- ---------------------------------------------------------------------------
-- Служебные таблицы отчёта
-- ---------------------------------------------------------------------------
create table if not exists public.report_excluded_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_excluded_venues (
  venue_id uuid primary key references public.restaurants (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_targets (
  metric text not null,
  target_date date not null,
  value numeric not null,
  primary key (metric, target_date)
);

create table if not exists public.report_cron_config (
  id integer primary key default 1 check (id = 1),
  function_url text
);

insert into public.report_targets (metric, target_date, value) values
  ('registered',       '2026-11-30', 500),
  ('registered',       '2027-01-31', 1500),
  ('registered',       '2027-04-30', 3000),
  ('weekly_active',    '2026-11-30', 50),
  ('weekly_active',    '2027-01-31', 150),
  ('weekly_active',    '2027-04-30', 400),
  ('redemptions_30d',  '2026-11-30', 100),
  ('redemptions_30d',  '2027-01-31', 300),
  ('redemptions_30d',  '2027-04-30', 800),
  ('retention_m2_pct', '2026-11-30', 15),
  ('retention_m2_pct', '2027-01-31', 25),
  ('retention_m2_pct', '2027-04-30', 30),
  ('active_venues',    '2026-11-30', 20),
  ('active_venues',    '2027-01-31', 35),
  ('active_venues',    '2027-04-30', 45)
on conflict (metric, target_date) do nothing;

insert into public.report_cron_config (id, function_url)
values (1, null)
on conflict (id) do nothing;

alter table public.report_excluded_users enable row level security;
alter table public.report_excluded_venues enable row level security;
alter table public.report_targets enable row level security;
alter table public.report_cron_config enable row level security;

revoke all on table public.report_excluded_users from public, anon, authenticated;
revoke all on table public.report_excluded_venues from public, anon, authenticated;
revoke all on table public.report_targets from public, anon, authenticated;
revoke all on table public.report_cron_config from public, anon, authenticated;
grant all on table public.report_excluded_users to service_role;
grant all on table public.report_excluded_venues to service_role;
grant all on table public.report_targets to service_role;
grant all on table public.report_cron_config to service_role;

comment on table public.report_excluded_users is
  'Гости, которых не считаем в отчёте (команда, тестовые аккаунты). Заполнить вручную.';
comment on table public.report_excluded_venues is
  'Тестовые заведения, которых нет в is_test. Заполнить вручную.';

-- ---------------------------------------------------------------------------
-- Индексы погашений
-- ---------------------------------------------------------------------------
create index if not exists redemptions_redeemed_at_idx
  on public.redemptions (redeemed_at);

create index if not exists redemptions_restaurant_redeemed_idx
  on public.redemptions (restaurant_id, redeemed_at);

-- ---------------------------------------------------------------------------
-- Подписи
-- ---------------------------------------------------------------------------
create or replace function public.report_weekday_label(p_isodow integer)
returns text
language sql
immutable
as $$
  select (array['пн','вт','ср','чт','пт','сб','вс'])[least(greatest(coalesce(p_isodow, 1), 1), 7)];
$$;

create or replace function public.report_week_label(p_start date)
returns text
language plpgsql
immutable
as $$
declare
  months text[] := array[
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];
  p_end date := p_start + 6;
begin
  if p_start is null then
    return null;
  end if;
  if extract(month from p_start) = extract(month from p_end) then
    return extract(day from p_start)::int::text
      || '–'
      || extract(day from p_end)::int::text
      || ' '
      || months[extract(month from p_start)::int];
  end if;
  return extract(day from p_start)::int::text
    || ' '
    || months[extract(month from p_start)::int]
    || ' – '
    || extract(day from p_end)::int::text
    || ' '
    || months[extract(month from p_end)::int];
end;
$$;

create or replace function public.report_monday(p_day date)
returns date
language sql
immutable
as $$
  select p_day - ((extract(isodow from p_day)::int) - 1);
$$;

-- Понедельник последней полной недели по Алматы.
create or replace function public.report_last_complete_monday(p_now timestamptz default now())
returns date
language sql
stable
as $$
  select public.report_monday((timezone('Asia/Almaty', p_now))::date) - 7;
$$;

-- ---------------------------------------------------------------------------
-- Гостевой фильтр: подтверждённый телефон, не staff/test/admin, не excluded
-- ---------------------------------------------------------------------------
create or replace function public.report_is_guest(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.phone is not null
      and coalesce(p.user_kind, 'customer') = 'customer'
      and coalesce(p.role, 'user') <> 'admin'
      and not exists (
        select 1 from public.report_excluded_users e where e.user_id = p.id
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Еженедельный отчёт
-- ---------------------------------------------------------------------------
create or replace function public.get_weekly_report(week_start date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_week date;
  v_prev date;
  v_from timestamptz;
  v_to timestamptz;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
  v_30_from timestamptz;
  v_prev_30_from timestamptz;
  v_cohort_from timestamptz;
  v_cohort_to timestamptz;
  v_prev_cohort_from timestamptz;
  v_prev_cohort_to timestamptz;
  v_asof date;
  v_target_date date;
  v_result jsonb;
begin
  if week_start is null then
    v_week := public.report_last_complete_monday(now());
  else
    v_week := public.report_monday(week_start);
  end if;

  v_prev := v_week - 7;
  v_from := (v_week::timestamp at time zone 'Asia/Almaty');
  v_to := ((v_week + 7)::timestamp at time zone 'Asia/Almaty');
  v_prev_from := (v_prev::timestamp at time zone 'Asia/Almaty');
  v_prev_to := v_from;
  v_30_from := v_to - interval '30 days';
  v_prev_30_from := v_prev_to - interval '30 days';
  v_asof := v_week + 7;
  -- Первое погашение 31–60 дней назад относительно конца недели.
  v_cohort_from := ((v_asof - 60)::timestamp at time zone 'Asia/Almaty');
  v_cohort_to := ((v_asof - 30)::timestamp at time zone 'Asia/Almaty');
  v_prev_cohort_from := ((v_asof - 67)::timestamp at time zone 'Asia/Almaty');
  v_prev_cohort_to := ((v_asof - 37)::timestamp at time zone 'Asia/Almaty');

  select min(t.target_date)
    into v_target_date
  from public.report_targets t
  where t.target_date >= v_asof;

  if v_target_date is null then
    select max(t.target_date) into v_target_date from public.report_targets t;
  end if;

  with guests as (
    select
      p.id,
      p.created_at,
      nullif(btrim(p.utm_source), '') as utm_source,
      nullif(btrim(p.utm_campaign), '') as utm_campaign,
      nullif(btrim(p.ref_code), '') as ref_code
    from public.profiles p
    where p.phone is not null
      and coalesce(p.user_kind, 'customer') = 'customer'
      and coalesce(p.role, 'user') <> 'admin'
      and not exists (
        select 1 from public.report_excluded_users e where e.user_id = p.id
      )
  ),
  guest_redemptions as (
    select
      r.id,
      r.user_id,
      r.restaurant_id,
      r.offer_id,
      r.redeemed_at,
      coalesce(o.estimated_value, 0) as estimated_value
    from public.redemptions r
    join guests g on g.id = r.user_id
    join public.offers o on o.id = r.offer_id
    where not exists (
      select 1 from public.report_excluded_venues v where v.venue_id = r.restaurant_id
    )
  ),
  first_redemption as (
    select user_id, min(redeemed_at) as first_at
    from guest_redemptions
    group by user_id
  ),
  first_at_venue as (
    select user_id, restaurant_id, min(redeemed_at) as first_at
    from guest_redemptions
    group by user_id, restaurant_id
  ),
  week_r as (
    select * from guest_redemptions
    where redeemed_at >= v_from and redeemed_at < v_to
  ),
  prev_r as (
    select * from guest_redemptions
    where redeemed_at >= v_prev_from and redeemed_at < v_prev_to
  ),
  venue_week as (
    select
      rest.restaurant_name as name,
      rest.city::text as city,
      rest.is_active,
      count(wr.id)::int as redemptions,
      count(distinct wr.user_id)::int as guests,
      count(distinct wr.user_id) filter (
        where fv.first_at >= v_from and fv.first_at < v_to
      )::int as new_guests,
      count(distinct wr.user_id) filter (
        where fv.first_at < v_from
      )::int as returning_guests,
      coalesce(sum(wr.estimated_value), 0)::bigint as savings
    from public.restaurants rest
    left join week_r wr on wr.restaurant_id = rest.id
    left join first_at_venue fv
      on fv.user_id = wr.user_id and fv.restaurant_id = rest.id
    where not exists (
      select 1 from public.report_excluded_venues ev where ev.venue_id = rest.id
    )
      and (rest.is_active or wr.id is not null)
    group by rest.id, rest.restaurant_name, rest.city, rest.is_active
  ),
  retention as (
    select
      count(*)::int as cohort,
      count(*) filter (
        where exists (
          select 1 from guest_redemptions r
          where r.user_id = fr.user_id
            and r.redeemed_at >= v_30_from
            and r.redeemed_at < v_to
        )
      )::int as retained
    from first_redemption fr
    where fr.first_at >= v_cohort_from and fr.first_at < v_cohort_to
  ),
  retention_prev as (
    select
      count(*)::int as cohort,
      count(*) filter (
        where exists (
          select 1 from guest_redemptions r
          where r.user_id = fr.user_id
            and r.redeemed_at >= v_prev_30_from
            and r.redeemed_at < v_prev_to
        )
      )::int as retained
    from first_redemption fr
    where fr.first_at >= v_prev_cohort_from and fr.first_at < v_prev_cohort_to
  ),
  by_dow as (
    select d::int as dow, count(wr.id)::int as count
    from generate_series(1, 7) as d
    left join week_r wr
      on extract(isodow from (wr.redeemed_at at time zone 'Asia/Almaty'))::int = d
    group by d
  ),
  by_hour as (
    select h::int as hour, count(wr.id)::int as count
    from generate_series(0, 23) as h
    left join week_r wr
      on extract(hour from (wr.redeemed_at at time zone 'Asia/Almaty'))::int = h
    group by h
  ),
  peak_hour as (
    select hour as start_hour
    from by_hour
    order by count desc,
      case when hour between 18 and 21 then 0 else 1 end,
      hour desc
    limit 1
  ),
  peak_dow as (
    select dow
    from by_dow
    order by count desc, dow
    limit 1
  ),
  new_week as (
    select * from guests where created_at >= v_from and created_at < v_to
  ),
  channels_utm as (
    select coalesce(utm_source, 'неизвестно') as source, count(*)::int as count
    from new_week
    group by 1
  ),
  channels_ref as (
    select ref_code as code, count(*)::int as count
    from new_week
    where ref_code is not null
    group by 1
  ),
  channels_combined as (
    select
      case
        when utm_source is not null then utm_source
        when ref_code is not null then 'ref'
        else 'неизвестно'
      end as channel,
      count(*)::int as count
    from new_week
    group by 1
  ),
  goals as (
    select
      t.metric,
      t.value as target,
      case t.metric
        when 'registered' then (
          select count(*)::numeric from guests where created_at < v_to
        )
        when 'weekly_active' then (
          select count(distinct user_id)::numeric from week_r
        )
        when 'redemptions_30d' then (
          select count(*)::numeric from guest_redemptions
          where redeemed_at >= v_30_from and redeemed_at < v_to
        )
        when 'retention_m2_pct' then (
          select case when cohort > 0
            then round(100.0 * retained / cohort, 1)
            else null end
          from retention
        )
        when 'active_venues' then (
          select count(*)::numeric from public.restaurants rest
          where rest.is_active
            and not exists (
              select 1 from public.report_excluded_venues ev where ev.venue_id = rest.id
            )
        )
        else null
      end as current_value
    from public.report_targets t
    where t.target_date = v_target_date
  )
  select jsonb_build_object(
    'week', jsonb_build_object(
      'start', v_week,
      'end', v_week + 6,
      'label', public.report_week_label(v_week)
    ),
    'users', jsonb_build_object(
      'registered_total', (select count(*) from guests where created_at < v_to),
      'registered_total_prev', (select count(*) from guests where created_at < v_prev_to),
      'new', (select count(*) from guests where created_at >= v_from and created_at < v_to),
      'new_prev', (select count(*) from guests where created_at >= v_prev_from and created_at < v_prev_to)
    ),
    'activity', jsonb_build_object(
      'weekly_active', (select count(distinct user_id) from week_r),
      'weekly_active_prev', (select count(distinct user_id) from prev_r),
      'redemptions', (select count(*) from week_r),
      'redemptions_prev', (select count(*) from prev_r),
      'redemptions_30d', (
        select count(*) from guest_redemptions
        where redeemed_at >= v_30_from and redeemed_at < v_to
      ),
      'redemptions_30d_prev', (
        select count(*) from guest_redemptions
        where redeemed_at >= v_prev_30_from and redeemed_at < v_prev_to
      )
    ),
    'retention_m2_pct', (
      select case when cohort > 0 then round(100.0 * retained / cohort, 1) else null end
      from retention
    ),
    'retention_m2_pct_prev', (
      select case when cohort > 0 then round(100.0 * retained / cohort, 1) else null end
      from retention_prev
    ),
    'retention_m2_cohort', (select cohort from retention),
    'savings', jsonb_build_object(
      'week', (select coalesce(sum(estimated_value), 0) from week_r),
      'week_prev', (select coalesce(sum(estimated_value), 0) from prev_r),
      'lifetime', (
        select coalesce(sum(estimated_value), 0) from guest_redemptions
        where redeemed_at < v_to
      )
    ),
    'venues', jsonb_build_object(
      'active', (
        select count(*) from public.restaurants rest
        where rest.is_active
          and not exists (
            select 1 from public.report_excluded_venues ev where ev.venue_id = rest.id
          )
      ),
      'with_redemptions', (select count(*) from venue_week where redemptions > 0),
      'with_redemptions_prev', (
        select count(distinct restaurant_id) from prev_r
      ),
      'zero_count', (select count(*) from venue_week where is_active and redemptions = 0),
      'zero_names', coalesce((
        select jsonb_agg(name order by name)
        from venue_week
        where is_active and redemptions = 0
      ), '[]'::jsonb)
    ),
    'top_venues', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb)
      from (
        select name, redemptions, guests, new_guests, returning_guests, savings
        from venue_week
        where redemptions > 0
        order by redemptions desc, guests desc, name
        limit 10
      ) t
    ), '[]'::jsonb),
    'top_offers', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb)
      from (
        select
          rest.restaurant_name as venue,
          o.offer_title as offer,
          count(*)::int as redemptions
        from week_r wr
        join public.restaurants rest on rest.id = wr.restaurant_id
        join public.offers o on o.id = wr.offer_id
        group by rest.restaurant_name, o.offer_title
        order by count(*) desc, rest.restaurant_name, o.offer_title
        limit 5
      ) t
    ), '[]'::jsonb),
    'venues_week', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb)
      from (
        select name, city, is_active, redemptions, guests, new_guests, returning_guests, savings
        from venue_week
        order by redemptions desc, name
      ) t
    ), '[]'::jsonb),
    'by_weekday', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dow', dow,
        'label', public.report_weekday_label(dow),
        'count', count
      ) order by dow)
      from by_dow
    ), '[]'::jsonb),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', hour, 'count', count) order by hour)
      from by_hour
    ), '[]'::jsonb),
    'peak', case
      when (select count(*) from week_r) = 0 then null
      else jsonb_build_object(
        'weekday', public.report_weekday_label((select dow from peak_dow)),
        'hour_start', (select start_hour from peak_hour),
        'hour_end', (select start_hour + 2 from peak_hour),
        'label', public.report_weekday_label((select dow from peak_dow))
          || ' '
          || (select start_hour from peak_hour)::text
          || '–'
          || (select start_hour + 2 from peak_hour)::text
          || ' ч'
      )
    end,
    'channels', jsonb_build_object(
      'by_utm_source', coalesce((
        select jsonb_agg(jsonb_build_object('source', source, 'count', count) order by count desc, source)
        from channels_utm
      ), '[]'::jsonb),
      'by_ref_code', coalesce((
        select jsonb_agg(jsonb_build_object('code', code, 'count', count) order by count desc, code)
        from channels_ref
      ), '[]'::jsonb),
      'combined', coalesce((
        select jsonb_agg(jsonb_build_object('channel', channel, 'count', count) order by count desc, channel)
        from channels_combined
      ), '[]'::jsonb)
    ),
    'goals', jsonb_build_object(
      'target_date', v_target_date,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'metric', metric,
          'current', current_value,
          'target', target,
          'pct', case
            when target is null or target = 0 or current_value is null then null
            else round(100.0 * current_value / target)
          end
        ) order by array_position(
          array['registered','weekly_active','redemptions_30d','retention_m2_pct','active_venues'],
          metric
        ))
        from goals
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_weekly_report(date) is
  'Еженедельный отчёт по гостям и погашениям (Asia/Almaty). Без персональных данных. Только service_role.';

-- ---------------------------------------------------------------------------
-- Отчёт заведения за месяц (заготовка для партнёров)
-- ---------------------------------------------------------------------------
create or replace function public.get_venue_report(venue_id uuid, month_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v_name text;
  v_result jsonb;
begin
  if venue_id is null or month_start is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_args');
  end if;

  select restaurant_name into v_name
  from public.restaurants
  where id = venue_id;

  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_from := (month_start::timestamp at time zone 'Asia/Almaty');
  v_to := ((month_start + interval '1 month')::timestamp at time zone 'Asia/Almaty');

  with guests as (
    select p.id
    from public.profiles p
    where p.phone is not null
      and coalesce(p.user_kind, 'customer') = 'customer'
      and coalesce(p.role, 'user') <> 'admin'
      and not exists (
        select 1 from public.report_excluded_users e where e.user_id = p.id
      )
  ),
  guest_redemptions as (
    select
      r.user_id,
      r.restaurant_id,
      r.redeemed_at,
      coalesce(o.estimated_value, 0) as estimated_value
    from public.redemptions r
    join guests g on g.id = r.user_id
    join public.offers o on o.id = r.offer_id
    where r.restaurant_id = venue_id
  ),
  first_at_venue as (
    select user_id, min(redeemed_at) as first_at
    from guest_redemptions
    group by user_id
  ),
  month_r as (
    select gr.*, fv.first_at
    from guest_redemptions gr
    join first_at_venue fv on fv.user_id = gr.user_id
    where gr.redeemed_at >= v_from and gr.redeemed_at < v_to
  ),
  by_dow as (
    select extract(isodow from (redeemed_at at time zone 'Asia/Almaty'))::int as dow,
           count(*)::int as count
    from month_r
    group by 1
  ),
  by_hour as (
    select extract(hour from (redeemed_at at time zone 'Asia/Almaty'))::int as hour,
           count(*)::int as count
    from month_r
    group by 1
  )
  select jsonb_build_object(
    'ok', true,
    'venue_name', v_name,
    'month_start', month_start,
    'redemptions', (select count(*) from month_r),
    'guests', (select count(distinct user_id) from month_r),
    'new_guests', (
      select count(distinct user_id) from month_r
      where first_at >= v_from and first_at < v_to
    ),
    'returning_guests', (
      select count(distinct user_id) from month_r
      where first_at < v_from
    ),
    'savings', (select coalesce(sum(estimated_value), 0) from month_r),
    'best_weekday', (
      select public.report_weekday_label(dow) from by_dow order by count desc, dow limit 1
    ),
    'best_hour', (
      select hour from by_hour order by count desc, hour limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_venue_report(uuid, date) is
  'Месячный отчёт заведения: погашения, гости, выгода, пик. Без персональных данных. Только service_role.';

-- ---------------------------------------------------------------------------
-- Вызов Edge Function из pg_cron
-- ---------------------------------------------------------------------------
create or replace function public.invoke_weekly_report()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_id bigint;
begin
  select c.function_url into v_url
  from public.report_cron_config c
  where c.id = 1;

  if v_url is null or length(btrim(v_url)) = 0 then
    raise notice 'weekly-report: report_cron_config.function_url пуст';
    return null;
  end if;

  v_secret := null;
  begin
    select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds
    where ds.name in ('WEEKLY_REPORT_SECRET', 'CRON_SECRET')
    order by case ds.name when 'WEEKLY_REPORT_SECRET' then 0 else 1 end
    limit 1;
  exception when others then
    v_secret := null;
  end;

  if v_secret is null or v_secret = '' then
    begin
      v_secret := nullif(current_setting('app.weekly_report_secret', true), '');
    exception when others then
      v_secret := null;
    end;
  end if;

  if v_secret is null or v_secret = '' then
    raise notice 'weekly-report: нет WEEKLY_REPORT_SECRET/CRON_SECRET в Vault';
    return null;
  end if;

  begin
    select net.http_post(
      url := btrim(v_url),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := '{}'::jsonb
    ) into v_id;
  exception when others then
    raise notice 'weekly-report: net.http_post недоступен: %', sqlerrm;
    return null;
  end;

  return v_id;
end;
$$;

create or replace function public.schedule_weekly_report(p_function_url text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  if p_function_url is not null and length(btrim(p_function_url)) > 0 then
    insert into public.report_cron_config (id, function_url)
    values (1, btrim(p_function_url))
    on conflict (id) do update set function_url = excluded.function_url;
  end if;

  select c.function_url into v_url from public.report_cron_config c where c.id = 1;

  begin
    if exists (select 1 from cron.job where jobname = 'weekly-report') then
      perform cron.unschedule('weekly-report');
    end if;
    perform cron.schedule(
      'weekly-report',
      '0 4 * * 1',
      'select public.invoke_weekly_report()'
    );
  exception when others then
    return 'pg_cron недоступен: ' || sqlerrm;
  end;

  return 'scheduled weekly-report 0 4 * * 1 utc, url=' || coalesce(v_url, '(empty)');
end;
$$;

-- ---------------------------------------------------------------------------
-- Права: только service_role
-- ---------------------------------------------------------------------------
revoke all on function public.report_weekday_label(integer) from public, anon, authenticated;
revoke all on function public.report_week_label(date) from public, anon, authenticated;
revoke all on function public.report_monday(date) from public, anon, authenticated;
revoke all on function public.report_last_complete_monday(timestamptz) from public, anon, authenticated;
revoke all on function public.report_is_guest(uuid) from public, anon, authenticated;
revoke all on function public.get_weekly_report(date) from public, anon, authenticated;
revoke all on function public.get_venue_report(uuid, date) from public, anon, authenticated;
revoke all on function public.invoke_weekly_report() from public, anon, authenticated;
revoke all on function public.schedule_weekly_report(text) from public, anon, authenticated;

grant execute on function public.report_weekday_label(integer) to service_role;
grant execute on function public.report_week_label(date) to service_role;
grant execute on function public.report_monday(date) to service_role;
grant execute on function public.report_last_complete_monday(timestamptz) to service_role;
grant execute on function public.report_is_guest(uuid) to service_role;
grant execute on function public.get_weekly_report(date) to service_role;
grant execute on function public.get_venue_report(uuid, date) to service_role;
grant execute on function public.invoke_weekly_report() to service_role;
grant execute on function public.schedule_weekly_report(text) to service_role;

-- ---------------------------------------------------------------------------
-- Расписание (если расширения уже включены)
-- ---------------------------------------------------------------------------
do $ext$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net skipped: %', sqlerrm;
end;
$ext$;

do $cron$
begin
  perform public.schedule_weekly_report(null);
exception when others then
  raise notice 'weekly-report cron skipped: %', sqlerrm;
end;
$cron$;
