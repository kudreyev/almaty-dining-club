-- Run in Supabase SQL editor or via CLI.
-- Minimal analytics events table for activation links funnel.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  activation_link_id uuid null references public.activation_links (id) on delete set null,
  token text null,
  phone_target text null,
  user_id uuid null references auth.users (id) on delete set null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_activation_link_id_idx
  on public.analytics_events (activation_link_id);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_admins_all" on public.analytics_events;

create policy "analytics_events_admins_all"
on public.analytics_events
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

-- Inserts are performed server-side; service role bypasses RLS.

