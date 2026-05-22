-- Дневные агрегаты целей из Яндекс.Метрики (Reporting API → Vercel Cron).
-- Источник правды: Метрика. Эта таблица — кэш для джойнов с подписками/redemptions.
--
-- Гранулярность: (date, goal_name, source). source = NULL для целей без параметра.
-- Идемпотентно: при повторном sync за тот же день — upsert через primary key.

create table if not exists public.metrica_goals_daily (
  date date not null,
  goal_name text not null,
  source text not null default '',
  visits int not null default 0,
  achievements int not null default 0,
  computed_at timestamptz not null default now(),
  primary key (date, goal_name, source)
);

create index if not exists metrica_goals_daily_goal_name_idx
  on public.metrica_goals_daily (goal_name, date desc);

create index if not exists metrica_goals_daily_source_idx
  on public.metrica_goals_daily (source, date desc)
  where source <> '';

-- Кэш numeric goal_id из Management API. Заполняется при первом sync.
-- Позволяет не дёргать Management API на каждый запрос.
create table if not exists public.metrica_goals_registry (
  goal_id bigint primary key,
  goal_name text not null unique,
  is_tracked boolean not null default true,
  synced_at timestamptz not null default now()
);

alter table public.metrica_goals_daily enable row level security;
alter table public.metrica_goals_registry enable row level security;

drop policy if exists "metrica_goals_daily_admin_read" on public.metrica_goals_daily;
drop policy if exists "metrica_goals_registry_admin_read" on public.metrica_goals_registry;

-- Чтение — только админам через RLS. Запись — только service role (cron route).
create policy "metrica_goals_daily_admin_read"
on public.metrica_goals_daily
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "metrica_goals_registry_admin_read"
on public.metrica_goals_registry
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
