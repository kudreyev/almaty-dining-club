-- Аналитический ledger подписчиков TipTop Pay (источник правды для /admin/analytics).
-- Не заменяет public.subscriptions (продуктовый доступ) — дополняет его.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  ttp_account_id text not null,
  email text null,
  phone text null,
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'past_due')),
  subscribed_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  promo_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscribers_ttp_account_id_key unique (ttp_account_id)
);

create index if not exists subscribers_status_idx
  on public.subscribers (status);

create index if not exists subscribers_subscribed_at_idx
  on public.subscribers (subscribed_at desc);

create index if not exists subscribers_cancelled_at_idx
  on public.subscribers (cancelled_at desc);

create index if not exists subscribers_utm_medium_idx
  on public.subscribers (utm_medium);

create index if not exists subscribers_utm_source_idx
  on public.subscribers (utm_source);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  ttp_transaction_id text not null,
  amount numeric(12, 2) not null default 0,
  status text not null check (status in ('success', 'fail')),
  created_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  constraint payments_ttp_transaction_id_key unique (ttp_transaction_id)
);

create index if not exists payments_subscriber_id_idx
  on public.payments (subscriber_id);

create index if not exists payments_created_at_idx
  on public.payments (created_at desc);

create index if not exists payments_status_idx
  on public.payments (status);

-- Ежедневные рекламные метрики (Facebook Ads + Яндекс.Метрика).
create table if not exists public.daily_ad_stats (
  date date primary key,
  spend numeric(12, 2) null,
  impressions bigint null,
  clicks bigint null,
  visits bigint null,
  goal_click_pay bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;
alter table public.payments enable row level security;
alter table public.daily_ad_stats enable row level security;

drop policy if exists "subscribers_admin_read" on public.subscribers;
create policy "subscribers_admin_read"
on public.subscribers
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "payments_admin_read" on public.payments;
create policy "payments_admin_read"
on public.payments
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "daily_ad_stats_admin_read" on public.daily_ad_stats;
create policy "daily_ad_stats_admin_read"
on public.daily_ad_stats
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
