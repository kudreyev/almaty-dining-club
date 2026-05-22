-- Дневной снимок продуктовых метрик (Слой 3). Заполняется cron /api/cron/daily-snapshot.
-- Используется для Telegram-алертов и исторического сравнения day-over-day.

create table if not exists public.metrics_daily_snapshot (
  date date primary key,
  active_subscribers int not null default 0,
  active_paid_subscribers int not null default 0,
  mrr_kzt int not null default 0,
  new_subs_24h int not null default 0,
  new_paid_subs_24h int not null default 0,
  redemptions_24h int not null default 0,
  whatsapp_clicks_24h int not null default 0,
  whatsapp_clicks_by_source jsonb not null default '{}'::jsonb,
  retention_30d_pct numeric null,
  expiring_next_7d int not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists metrics_daily_snapshot_computed_at_idx
  on public.metrics_daily_snapshot (computed_at desc);

alter table public.metrics_daily_snapshot enable row level security;

drop policy if exists "metrics_daily_snapshot_admin_read" on public.metrics_daily_snapshot;

create policy "metrics_daily_snapshot_admin_read"
on public.metrics_daily_snapshot
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
