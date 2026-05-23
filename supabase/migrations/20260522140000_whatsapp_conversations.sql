-- WhatsApp Cloud API copilot (Слой 5): входящие сообщения и черновики ответов.

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null,
  phone_e164 text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'resolved')),
  intent text null
    check (intent is null or intent in ('subscribe', 'renew', 'support', 'unknown')),
  last_inbound_text text null,
  last_message_at timestamptz not null default now(),
  copilot_draft text null,
  copilot_context jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_conversations_wa_id_idx
  on public.whatsapp_conversations (wa_id);

create index if not exists whatsapp_conversations_status_idx
  on public.whatsapp_conversations (status, last_message_at desc);

create index if not exists whatsapp_conversations_phone_idx
  on public.whatsapp_conversations (phone_e164);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations (id) on delete cascade,
  wamid text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  raw_payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, created_at desc);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists "whatsapp_conversations_admin_read" on public.whatsapp_conversations;
drop policy if exists "whatsapp_messages_admin_read" on public.whatsapp_messages;

create policy "whatsapp_conversations_admin_read"
on public.whatsapp_conversations
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "whatsapp_messages_admin_read"
on public.whatsapp_messages
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Запись — только service role (webhook + admin actions через server).
