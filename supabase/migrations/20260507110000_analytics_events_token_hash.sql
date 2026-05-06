-- Store activation correlation id as SHA-256 prefix instead of raw token.

alter table public.analytics_events
  add column if not exists token_hash text null;

create index if not exists analytics_events_token_hash_idx
  on public.analytics_events (token_hash)
  where token_hash is not null;

-- Remove historical plaintext tokens from analytics (secret rotation / risk reduction).
update public.analytics_events
set token = null
where token is not null;
