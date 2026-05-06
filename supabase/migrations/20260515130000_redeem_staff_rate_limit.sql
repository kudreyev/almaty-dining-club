-- Staff redeem verification failures (PIN / token lookup) for brute-force protection.

create table if not exists public.redeem_rate_failures (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null,
  event_kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists redeem_rate_failures_key_created_idx
  on public.redeem_rate_failures (key_hash, created_at desc);

create table if not exists public.redeem_rate_blocks (
  key_hash text primary key,
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.redeem_rate_failures enable row level security;
alter table public.redeem_rate_blocks enable row level security;

comment on table public.redeem_rate_failures is
  'Append-only; written via service_role after failed staff redeem/PIN checks.';
comment on table public.redeem_rate_blocks is
  'Active blocks per key_hash; read/write via service_role from server.';
