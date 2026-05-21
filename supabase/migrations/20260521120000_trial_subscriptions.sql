-- Trial subscriptions:
--   1) activation_links: kind ('paid'|'trial') + trial_days
--   2) subscriptions: plan_type ('paid'|'trial')
--   3) profiles: trial_used (one trial per phone, enforced at admin + RPC layers)
--   4) activate_subscription_atomic: handle trial activation (14d, mark trial_used)

-- ---------------------------------------------------------------------------
-- 1) activation_links
-- ---------------------------------------------------------------------------
alter table public.activation_links
  add column if not exists kind text not null default 'paid';

alter table public.activation_links
  add column if not exists trial_days int;

-- Constraints (idempotent: drop+recreate so re-runs stay safe).
alter table public.activation_links
  drop constraint if exists activation_links_kind_check;
alter table public.activation_links
  add constraint activation_links_kind_check
  check (kind in ('paid', 'trial'));

alter table public.activation_links
  drop constraint if exists activation_links_trial_days_check;
alter table public.activation_links
  add constraint activation_links_trial_days_check
  check (
    (kind = 'paid' and trial_days is null)
    or (kind = 'trial' and trial_days is not null and trial_days > 0)
  );

create index if not exists activation_links_kind_phone_idx
  on public.activation_links (phone_target, kind);

-- ---------------------------------------------------------------------------
-- 2) subscriptions
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists plan_type text not null default 'paid';

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_type_check;
alter table public.subscriptions
  add constraint subscriptions_plan_type_check
  check (plan_type in ('paid', 'trial'));

-- ---------------------------------------------------------------------------
-- 3) profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists trial_used boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4) RPC update: support trial activation atomically
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
begin
  -- Inspect the link first (still issued?). We don't claim it yet so that
  -- the trial_used guard can short-circuit without burning the link.
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
