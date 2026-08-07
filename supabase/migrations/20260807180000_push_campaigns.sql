-- История админ-рассылок Web Push.

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text not null,
  segment text not null check (segment in ('all', 'self')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  click_count integer not null default 0,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists push_campaigns_created_at_idx
  on public.push_campaigns (created_at desc);

create index if not exists push_campaigns_segment_created_idx
  on public.push_campaigns (segment, created_at desc);

alter table public.push_campaigns enable row level security;

-- Только админы читают историю; запись — через service_role / admin API.
create policy "push_campaigns_admin_read"
  on public.push_campaigns for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
