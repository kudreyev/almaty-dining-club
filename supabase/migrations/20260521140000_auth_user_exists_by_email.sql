-- public.auth_user_exists_by_email — точечная проверка существования auth-пользователя
-- по синтетическому email (wa_<digits>@wa.local) без создания.
--
-- Используется в флоу логина, чтобы:
--   * НЕ создавать аккаунт при попытке входа человека без подписки;
--   * пускать обычный OTP-флоу только если auth.user уже существует.
--
-- Создание аккаунта остаётся возможным только в флоу /activate с валидным токеном.

create or replace function public.auth_user_exists_by_email(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users where email = p_email)
$$;

revoke all on function public.auth_user_exists_by_email(text) from public;
grant execute on function public.auth_user_exists_by_email(text) to service_role;
