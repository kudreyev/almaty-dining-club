-- Внутренние пользователи (staff/test) не участвуют в продуктовой аналитике.
-- Staff получает бессрочную подписку plan_type='staff', end_date=2099-12-31.

-- ---------------------------------------------------------------------------
-- 1) profiles.user_kind
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists user_kind text not null default 'customer';

alter table public.profiles
  drop constraint if exists profiles_user_kind_check;
alter table public.profiles
  add constraint profiles_user_kind_check
  check (user_kind in ('customer', 'staff', 'test'));

create index if not exists profiles_user_kind_idx on public.profiles (user_kind);

-- ---------------------------------------------------------------------------
-- 2) subscriptions.plan_type += staff
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_type_check;
alter table public.subscriptions
  add constraint subscriptions_plan_type_check
  check (plan_type in ('paid', 'trial', 'staff'));

-- ---------------------------------------------------------------------------
-- 3) helpers
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone_digits(p_phone text)
returns text
language sql
immutable
as $$
  with raw as (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
  )
  select case
    when length(d) = 11 and left(d, 1) = '8' then '7' || right(d, 10)
    else d
  end
  from raw;
$$;

create or replace function public.mark_profiles_staff_by_phones(p_phones text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_digits text[];
  v_updated int;
begin
  if p_phones is null or cardinality(p_phones) = 0 then
    return 0;
  end if;

  select coalesce(array_agg(distinct public.normalize_phone_digits(p)), '{}')
    into v_target_digits
  from unnest(p_phones) as u(p)
  where public.normalize_phone_digits(p) <> '';

  update public.profiles p
  set user_kind = 'staff'
  where public.normalize_phone_digits(p.phone) = any (v_target_digits)
     or public.normalize_phone_digits(
          (select u.phone from auth.users u where u.id = p.id limit 1)
        ) = any (v_target_digits);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_profiles_staff_by_phones(text[]) from public;
grant execute on function public.mark_profiles_staff_by_phones(text[]) to service_role;

create or replace function public.ensure_staff_subscription(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_today date := (timezone('utc', now()))::date;
begin
  update public.subscriptions
  set status = 'expired'
  where user_id = p_user_id
    and status = 'active'
    and plan_type is distinct from 'staff';

  select s.id
    into v_sub_id
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.plan_type = 'staff'
  order by s.created_at desc nulls last
  limit 1;

  if v_sub_id is not null then
    update public.subscriptions
    set
      status = 'active',
      plan_name = 'staff_access',
      plan_type = 'staff',
      start_date = v_today,
      end_date = '2099-12-31'::date
    where id = v_sub_id;
  else
    insert into public.subscriptions (
      user_id,
      status,
      plan_name,
      plan_type,
      start_date,
      end_date
    )
    values (
      p_user_id,
      'active',
      'staff_access',
      'staff',
      v_today,
      '2099-12-31'::date
    )
    returning id into v_sub_id;
  end if;

  return v_sub_id;
end;
$$;

revoke all on function public.ensure_staff_subscription(uuid) from public;
grant execute on function public.ensure_staff_subscription(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4) activate_subscription_atomic: не трогаем staff/test
-- ---------------------------------------------------------------------------
create or replace function public.activate_subscription_atomic(
  p_token text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_subscription_id uuid;
  v_start date;
  v_end date;
  v_kind text;
  v_trial_days int;
  v_plan_type text;
  v_plan_name text;
  v_trial_used boolean;
  v_user_kind text;
begin
  select coalesce(p.user_kind, 'customer')
    into v_user_kind
  from public.profiles p
  where p.id = p_user_id;

  if v_user_kind is distinct from 'customer' then
    return jsonb_build_object('ok', false, 'reason', 'not_customer');
  end if;

  select kind, coalesce(trial_days, 14)
    into v_kind, v_trial_days
  from public.activation_links
  where token = p_token
    and status = 'issued'
  limit 1;

  if v_kind is null then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  v_start := (timezone('utc', now()))::date;

  if v_kind = 'trial' then
    select coalesce(p.trial_used, false)
      into v_trial_used
    from public.profiles p
    where p.id = p_user_id;

    if v_trial_used is true then
      return jsonb_build_object('ok', false, 'reason', 'trial_already_used');
    end if;

    v_plan_type := 'trial';
    v_plan_name := 'trial_14d';
    v_end := v_start + v_trial_days;
  else
    v_plan_type := 'paid';
    v_plan_name := 'monthly_almaty';
    v_end := v_start + 30;
  end if;

  update public.activation_links
  set
    status = 'activated',
    activated_user_id = p_user_id,
    activated_at = timezone('utc', now())
  where token = p_token
    and status = 'issued'
  returning id into v_link_id;

  if v_link_id is null then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  select s.id
  into v_subscription_id
  from public.subscriptions s
  where s.user_id = p_user_id
  order by s.created_at desc nulls last
  limit 1;

  if v_subscription_id is not null then
    update public.subscriptions
    set
      status = 'active',
      plan_name = v_plan_name,
      plan_type = v_plan_type,
      start_date = v_start,
      end_date = v_end
    where id = v_subscription_id;

    if not found then
      raise exception 'subscription_update_miss';
    end if;
  else
    insert into public.subscriptions (
      user_id,
      status,
      plan_name,
      plan_type,
      start_date,
      end_date
    )
    values (
      p_user_id,
      'active',
      v_plan_name,
      v_plan_type,
      v_start,
      v_end
    )
    returning id into v_subscription_id;

    if v_subscription_id is null then
      raise exception 'subscription_insert_miss';
    end if;
  end if;

  if v_kind = 'trial' then
    update public.profiles
       set trial_used = true
     where id = p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'link_id', v_link_id,
    'subscription_id', v_subscription_id,
    'kind', v_kind,
    'plan_type', v_plan_type,
    'end_date', v_end
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'reason', 'subscription_error'
    );
end;
$$;

revoke all on function public.activate_subscription_atomic(text, uuid) from public;
grant execute on function public.activate_subscription_atomic(text, uuid) to service_role;
