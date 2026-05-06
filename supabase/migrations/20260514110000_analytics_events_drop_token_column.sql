-- Deploy after ~7d on production once all writers use token_hash only.
-- (Fresh local resets run this immediately after the token_hash migration.)

alter table public.analytics_events
  drop column if exists token;
