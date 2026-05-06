-- Atomic activation: claim activation_links + upsert subscriptions in one transaction.
-- If subscription write fails, claim is rolled back (link stays issued).

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
begin
  v_start := (timezone('utc', now()))::date;
  v_end := v_start + 30;

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
      plan_name = 'monthly_almaty',
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
      start_date,
      end_date
    )
    values (
      p_user_id,
      'active',
      'monthly_almaty',
      v_start,
      v_end
    )
    returning id into v_subscription_id;

    if v_subscription_id is null then
      raise exception 'subscription_insert_miss';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'link_id', v_link_id,
    'subscription_id', v_subscription_id
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
