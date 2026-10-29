-- Закрываем обходы выдачи кода. ПРИМЕНЯТЬ ПОСЛЕ ДЕПЛОЯ нового кода
-- (старый код вставляет redeem_tokens напрямую и после этой миграции перестанет).
--
-- Было: authenticated мог INSERT/UPDATE свои redeem_tokens напрямую (мимо лимитов),
-- anon мог UPDATE любой redeem_token и INSERT в redemptions.
-- Стало: гость только читает свои коды; выдача — issue_redeem_token(),
-- продление — extend_redeem_token(), гашение — redeem_token_atomic() (service_role).

-- ---------------------------------------------------------------------------
-- redeem_tokens: только чтение своих строк
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'redeem_tokens'
  loop
    execute format('drop policy if exists %I on public.redeem_tokens', r.policyname);
  end loop;
end $$;

create policy "redeem_tokens_select_own"
  on public.redeem_tokens for select to authenticated
  using (user_id = auth.uid());

create policy "redeem_tokens_admin_all"
  on public.redeem_tokens for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- redemptions: гость читает свою историю, админ — всё; вставка только service_role
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'redemptions'
  loop
    execute format('drop policy if exists %I on public.redemptions', r.policyname);
  end loop;
end $$;

create policy "redemptions_select_own"
  on public.redemptions for select to authenticated
  using (user_id = auth.uid());

create policy "redemptions_admin_all"
  on public.redemptions for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Оплаты больше не принимаются: заявки Kaspi только для чтения
-- ---------------------------------------------------------------------------
drop policy if exists "payment_requests_insert_own" on public.payment_requests;

-- ---------------------------------------------------------------------------
-- Служебные функции — только service_role
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'redeem_token_atomic',
        'activate_subscription_atomic',
        'ensure_staff_subscription',
        'mark_profiles_staff_by_phones',
        'increment_promo_code_usage',
        'auth_user_exists_by_email'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end $$;
