-- Atomic staff redeem: lock token, mark redeemed, insert redemption in one transaction.
-- Idempotent retries within a short window (double-click) return success, not already_used.

create unique index if not exists redemptions_redeem_token_id_uidx
  on public.redemptions (redeem_token_id);

create or replace function public.redeem_token_atomic(
  p_token_code text,
  p_restaurant_id uuid,
  p_staff_user_id uuid,
  p_idempotency_window_seconds int default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.redeem_tokens%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_redeemed_at timestamptz;
  v_redemption_id uuid;
  v_window interval;
begin
  v_window := make_interval(secs => greatest(p_idempotency_window_seconds, 0));

  select *
  into v_token
  from public.redeem_tokens
  where token_code = p_token_code
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_token.used_at is not null or v_token.status <> 'active' then
    if v_token.status = 'redeemed' and v_token.used_at is not null then
      if v_token.used_at >= v_now - v_window then
        select r.id
        into v_redemption_id
        from public.redemptions r
        where r.redeem_token_id = v_token.id
        limit 1;

        return jsonb_build_object(
          'ok', true,
          'idempotent', true,
          'token_id', v_token.id,
          'redemption_id', v_redemption_id
        );
      end if;

      return jsonb_build_object('ok', false, 'reason', 'already_used');
    end if;

    if v_token.status = 'expired' then
      return jsonb_build_object('ok', false, 'reason', 'expired');
    end if;

    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  if v_token.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  v_redeemed_at := v_now;

  update public.redeem_tokens
  set
    status = 'redeemed',
    used_at = v_redeemed_at,
    redeemed_at = v_redeemed_at,
    redeemed_by_staff_id = p_staff_user_id
  where id = v_token.id
    and status = 'active'
    and used_at is null;

  if not found then
    select *
    into v_token
    from public.redeem_tokens
    where id = v_token.id;

    if v_token.status = 'redeemed'
       and v_token.used_at is not null
       and v_token.used_at >= v_now - v_window then
      select r.id
      into v_redemption_id
      from public.redemptions r
      where r.redeem_token_id = v_token.id
      limit 1;

      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'token_id', v_token.id,
        'redemption_id', v_redemption_id
      );
    end if;

    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  insert into public.redemptions (
    user_id,
    restaurant_id,
    offer_id,
    redeem_token_id,
    staff_user_id,
    redeemed_at
  )
  values (
    v_token.user_id,
    v_token.restaurant_id,
    v_token.offer_id,
    v_token.id,
    p_staff_user_id,
    v_redeemed_at
  )
  on conflict (redeem_token_id) do nothing
  returning id into v_redemption_id;

  if v_redemption_id is null then
    select r.id
    into v_redemption_id
    from public.redemptions r
    where r.redeem_token_id = v_token.id
    limit 1;

    if v_redemption_id is not null then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'token_id', v_token.id,
        'redemption_id', v_redemption_id
      );
    end if;

    raise exception 'redemption_insert_miss';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'token_id', v_token.id,
    'redemption_id', v_redemption_id
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'reason', 'server_error');
end;
$$;

revoke all on function public.redeem_token_atomic(text, uuid, uuid, int) from public;
grant execute on function public.redeem_token_atomic(text, uuid, uuid, int) to service_role;

comment on function public.redeem_token_atomic(text, uuid, uuid, int) is
  'Staff redeem: atomic token burn + redemption row; idempotent within p_idempotency_window_seconds.';
