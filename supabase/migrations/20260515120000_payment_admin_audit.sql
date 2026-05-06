-- Audit trail for admin actions on payment_requests (approve, reject, amount edits).

create table if not exists public.payment_admin_audit (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('approve', 'reject', 'amount_edit')),
  payment_request_id uuid not null,
  actor_user_id uuid not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_admin_audit_payment_request_id_idx
  on public.payment_admin_audit (payment_request_id desc);

create index if not exists payment_admin_audit_created_at_idx
  on public.payment_admin_audit (created_at desc);

alter table public.payment_admin_audit enable row level security;

comment on table public.payment_admin_audit is
  'Inserts via service_role / server after admin auth; no end-user policies.';
