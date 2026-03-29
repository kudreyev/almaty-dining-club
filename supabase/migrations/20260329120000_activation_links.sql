-- Run in Supabase SQL editor or via CLI.
-- activation_links: manual subscription activation tokens (manager-created).

create table if not exists public.activation_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  phone_target text not null,
  status text not null default 'issued'
    check (status in ('issued', 'activated', 'revoked', 'expired')),
  amount int not null default 4990,
  currency text not null default 'KZT',
  activated_user_id uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists activation_links_token_idx on public.activation_links (token);
create index if not exists activation_links_created_at_idx on public.activation_links (created_at desc);

alter table public.activation_links enable row level security;

drop policy if exists "activation_links_admins_all" on public.activation_links;

create policy "activation_links_admins_all"
on public.activation_links
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Service role bypasses RLS (used by server-side activation after session verification).
