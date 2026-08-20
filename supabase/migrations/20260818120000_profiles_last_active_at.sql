-- Трек последней активности пользователя для триггерных push-напоминаний.

alter table public.profiles
  add column if not exists last_active_at timestamptz null;

create index if not exists profiles_last_active_at_idx
  on public.profiles (last_active_at)
  where last_active_at is not null;
