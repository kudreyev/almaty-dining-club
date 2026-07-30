-- Брошенные корзины + one-time token для автологина после оплаты.
-- Телефон пишется ДО оплаты (лид), статус paid ставит только Pay-вебхук.

create table if not exists public.pending_checkouts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  one_time_token text not null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  promo_code text null,
  source text null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired')),
  existing_account boolean not null default false,
  user_id uuid null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  paid_at timestamptz null,
  token_used_at timestamptz null,
  constraint pending_checkouts_one_time_token_key unique (one_time_token)
);

create index if not exists pending_checkouts_phone_created_idx
  on public.pending_checkouts (phone, created_at desc);

create index if not exists pending_checkouts_status_expires_idx
  on public.pending_checkouts (status, expires_at);

alter table public.pending_checkouts enable row level security;

-- payments: статус refunded для Refund-вебхука
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('success', 'fail', 'refunded'));
