-- PWA и Web Push: частота предложения установки, подписки по городам, журнал
-- отправок с лимитом 2 push в неделю на человека, сегменты для Edge Function
-- send-push и метрика удержания «установившие PWA против остальных».

-- ---------------------------------------------------------------------------
-- profiles: состояние предложения установки (дублирует localStorage, чтобы
-- переживать смену браузера / установку PWA с отдельным хранилищем на iOS)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists install_prompt_shown_count integer not null default 0,
  add column if not exists install_prompt_dismissed_at timestamptz null,
  add column if not exists pwa_installed_at timestamptz null,
  -- Нужна /api/heartbeat и крону push-inactivity; в проде миграция 20260818 не применялась.
  add column if not exists last_active_at timestamptz null;

create or replace function public.record_pwa_event(p_event text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.profiles%rowtype;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_event = 'prompt_shown' then
    update public.profiles
      set install_prompt_shown_count = install_prompt_shown_count + 1
      where id = v_user;
  elsif p_event = 'prompt_dismissed' then
    update public.profiles set install_prompt_dismissed_at = now() where id = v_user;
  elsif p_event = 'installed' then
    update public.profiles
      set pwa_installed_at = coalesce(pwa_installed_at, now())
      where id = v_user;
  elsif p_event is distinct from 'get' then
    raise exception 'unknown_event' using errcode = '22023';
  end if;

  select * into v_row from public.profiles where id = v_user;
  return jsonb_build_object(
    'shown_count', coalesce(v_row.install_prompt_shown_count, 0),
    'dismissed_at', v_row.install_prompt_dismissed_at,
    'installed_at', v_row.pwa_installed_at
  );
end;
$$;

revoke all on function public.record_pwa_event(text) from public, anon;
grant execute on function public.record_pwa_event(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- push_subscriptions: город и признак активности (404/410 → is_active = false,
-- строки не удаляем). subscriber_id = profiles.id = auth.users.id.
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions
  add column if not exists city text null,
  add column if not exists is_active boolean not null default true;

create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions (subscriber_id)
  where is_active;

-- ---------------------------------------------------------------------------
-- push_log: одна строка на отправку на устройство. Только service_role.
-- ---------------------------------------------------------------------------
create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid null references public.push_subscriptions (id) on delete set null,
  campaign text not null,
  title text not null,
  url text not null,
  status text not null check (status in ('sent', 'failed', 'gone')),
  error_code integer null,
  created_at timestamptz not null default now()
);

create index if not exists push_log_user_created_idx
  on public.push_log (user_id, created_at desc);
create index if not exists push_log_campaign_idx
  on public.push_log (campaign, created_at desc);

alter table public.push_log enable row level security;
revoke all on table public.push_log from anon, authenticated;

-- Лимит: не больше 2 разных кампаний за 7 дней (несколько устройств = одна кампания).
create or replace function public.push_weekly_count(p_user uuid, p_exclude_campaign text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct campaign)::integer
  from public.push_log
  where user_id = p_user
    and status = 'sent'
    and created_at > now() - interval '7 days'
    and (p_exclude_campaign is null or campaign <> p_exclude_campaign);
$$;

-- Окно отправки: 11:00–21:00 по Алматы.
create or replace function public.push_allowed_now(p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = public
as $$
  select extract(hour from (p_at at time zone 'Asia/Almaty')) between 11 and 20;
$$;

-- Получатели сегмента. p_segment: all | inactive_14d | new_7d. p_city: almaty | astana | null.
-- Город подписки, а для старых подписок без города — город последнего полученного кода.
create or replace function public.push_segment_recipients(
  p_segment text default 'all',
  p_city text default null,
  p_campaign text default null
)
returns table (user_id uuid, endpoints integer, quota_ok boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_segment not in ('all', 'inactive_14d', 'new_7d') then
    raise exception 'unknown_segment' using errcode = '22023';
  end if;

  return query
  with subs as (
    select
      s.subscriber_id,
      count(*)::integer as endpoints,
      coalesce(
        max(s.city),
        (
          select rest.city::text
          from public.redeem_tokens t
          join public.restaurants rest on rest.id = t.restaurant_id
          where t.user_id = s.subscriber_id
          order by t.issued_at desc
          limit 1
        )
      ) as city
    from public.push_subscriptions s
    where s.is_active
    group by s.subscriber_id
  )
  select
    subs.subscriber_id,
    subs.endpoints,
    public.push_weekly_count(subs.subscriber_id, p_campaign) < 2
  from subs
  join public.profiles p on p.id = subs.subscriber_id
  where (p_city is null or subs.city = p_city)
    and (
      p_segment = 'all'
      or (p_segment = 'new_7d' and p.created_at > now() - interval '7 days')
      or (
        p_segment = 'inactive_14d'
        and not exists (
          select 1 from public.redeem_tokens t
          where t.user_id = subs.subscriber_id
            and t.issued_at > now() - interval '14 days'
        )
      )
    );
end;
$$;

revoke all on function public.push_weekly_count(uuid, text) from public, anon, authenticated;
revoke all on function public.push_segment_recipients(text, text, text) from public, anon, authenticated;
grant execute on function public.push_weekly_count(uuid, text) to service_role;
grant execute on function public.push_segment_recipients(text, text, text) to service_role;
grant execute on function public.push_allowed_now(timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Главная метрика: доля гостей с 2+ погашениями среди установивших PWA и остальных.
-- Гости = profiles.user_kind = 'customer'. Только service_role (админка).
-- ---------------------------------------------------------------------------
create or replace function public.pwa_retention_stats()
returns table (
  installed boolean,
  guests integer,
  with_1plus integer,
  with_2plus integer
)
language sql
stable
security definer
set search_path = public
as $$
  with per_user as (
    select
      p.id,
      p.pwa_installed_at is not null as installed,
      (select count(*) from public.redemptions r where r.user_id = p.id) as redemptions
    from public.profiles p
    where coalesce(p.user_kind, 'customer') = 'customer'
      and coalesce(p.role, 'user') <> 'admin'
  )
  select
    installed,
    count(*)::integer,
    count(*) filter (where redemptions >= 1)::integer,
    count(*) filter (where redemptions >= 2)::integer
  from per_user
  group by installed
  order by installed desc;
$$;

revoke all on function public.pwa_retention_stats() from public, anon, authenticated;
grant execute on function public.pwa_retention_stats() to service_role;
