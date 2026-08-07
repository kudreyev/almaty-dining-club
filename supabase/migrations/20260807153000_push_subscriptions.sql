-- Web Push подписки (VAPID). subscriber_id = profiles.id (залогиненный пользователь).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text null,
  created_at timestamptz not null default now(),
  last_success_at timestamptz null,
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_subscriber_id_idx
  on public.push_subscriptions (subscriber_id);

alter table public.push_subscriptions enable row level security;

-- Клиентские операции только со своими строками; массовая отправка — service_role.
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (subscriber_id = auth.uid());

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (subscriber_id = auth.uid());

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (subscriber_id = auth.uid())
  with check (subscriber_id = auth.uid());

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (subscriber_id = auth.uid());
