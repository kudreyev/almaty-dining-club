-- Превью фестивалей: коды на сеты выдаём только админам.
-- Когда откроете всем — удалите этот блок из issue_redeem_token
-- (или примените следующую миграцию) и поставьте FESTIVAL_ADMIN_ONLY=false.

create or replace function public.issue_redeem_token(
  p_restaurant_id uuid,
  p_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_offer record;
  v_active record;
  v_code text;
  v_token_id uuid;
  v_expires_at timestamptz;
  v_attempt int := 0;
  v_today date;
  v_set_count int;
  v_max_sets int;
  v_combine boolean;
  v_is_set boolean;
  v_blocked boolean;
  v_is_admin boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and nullif(btrim(p.phone), '') is not null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'phone_not_verified');
  end if;

  select
    o.id,
    o.offer_type,
    o.event_id,
    o.end_date,
    o.is_active,
    r.is_active as restaurant_active,
    r.combine_set_with_club_offer,
    e.max_sets_per_venue_per_day,
    e.is_published as event_published,
    e.starts_at as event_starts,
    e.ends_at as event_ends
  into v_offer
  from public.offers o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.events e on e.id = o.event_id
  where o.id = p_offer_id
    and o.restaurant_id = p_restaurant_id;

  if not found
     or not v_offer.is_active
     or not v_offer.restaurant_active then
    return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  end if;

  v_today := (v_now at time zone 'Asia/Almaty')::date;
  v_is_set := v_offer.offer_type = 'set';

  -- Admin-only preview for festival sets.
  if v_is_set then
    select coalesce(p.role, 'user') = 'admin'
    into v_is_admin
    from public.profiles p
    where p.id = v_user_id;

    if not coalesce(v_is_admin, false) then
      return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
    end if;
  end if;

  if v_is_set then
    if v_offer.event_id is null
       or not coalesce(v_offer.event_published, false)
       or v_today < v_offer.event_starts
       or v_today > v_offer.event_ends then
      return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
    end if;
  elsif v_offer.end_date is not null and v_offer.end_date < v_today then
    return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('kuda_redeem_user:' || v_user_id::text, 0));

  select t.id, t.offer_id, t.expires_at
  into v_active
  from public.redeem_tokens t
  where t.user_id = v_user_id
    and t.status = 'active'
    and t.used_at is null
    and t.expires_at > v_now
  order by t.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'active_token',
      'token_id', v_active.id,
      'offer_id', v_active.offer_id,
      'expires_at', v_active.expires_at
    );
  end if;

  if not public.offer_is_usable_now(p_offer_id, v_now) then
    return jsonb_build_object('ok', false, 'reason', 'usable_hours');
  end if;

  v_combine := coalesce(v_offer.combine_set_with_club_offer, false);
  if not v_combine then
    if v_is_set then
      select exists (
        select 1
        from public.redemptions r
        where r.user_id = v_user_id
          and r.restaurant_id = p_restaurant_id
          and r.redeemed_at > v_now - interval '3 hours'
          and coalesce(r.offer_type, '') in ('2for1', 'compliment')
      ) into v_blocked;
    else
      select exists (
        select 1
        from public.redemptions r
        where r.user_id = v_user_id
          and r.restaurant_id = p_restaurant_id
          and r.redeemed_at > v_now - interval '3 hours'
          and coalesce(r.offer_type, '') = 'set'
      ) into v_blocked;
    end if;

    if v_blocked then
      return jsonb_build_object('ok', false, 'reason', 'combine_blocked');
    end if;
  end if;

  if v_is_set then
    v_max_sets := coalesce(v_offer.max_sets_per_venue_per_day, 1);
    select count(*)::int
    into v_set_count
    from public.redemptions r
    where r.user_id = v_user_id
      and r.restaurant_id = p_restaurant_id
      and r.event_id = v_offer.event_id
      and coalesce(r.offer_type, 'set') = 'set'
      and (r.redeemed_at at time zone 'Asia/Almaty')::date = v_today;

    if v_set_count >= v_max_sets then
      return jsonb_build_object('ok', false, 'reason', 'set_daily_limit');
    end if;
  end if;

  v_expires_at := v_now + interval '10 minutes';

  loop
    v_attempt := v_attempt + 1;
    v_code := (
      ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint
      % 900000 + 100000
    )::text;

    begin
      insert into public.redeem_tokens (
        user_id,
        restaurant_id,
        offer_id,
        offer_type,
        event_id,
        token_code,
        status,
        issued_at,
        expires_at,
        extend_deadline_at,
        extended_once,
        used_at
      )
      values (
        v_user_id,
        p_restaurant_id,
        p_offer_id,
        v_offer.offer_type,
        v_offer.event_id,
        v_code,
        'active',
        v_now,
        v_expires_at,
        v_now + interval '1 hour',
        false,
        null
      )
      returning id into v_token_id;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 20 then
          return jsonb_build_object('ok', false, 'reason', 'server_error');
        end if;
    end;
  end loop;

  insert into public.analytics_events (event_name, user_id, meta)
  values (
    'code_requested',
    v_user_id,
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'offer_id', p_offer_id,
      'token_id', v_token_id,
      'offer_type', v_offer.offer_type,
      'event_id', v_offer.event_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'token_id', v_token_id,
    'token_code', v_code,
    'expires_at', v_expires_at
  );
end;
$$;

comment on function public.issue_redeem_token(uuid, uuid) is
  'Выдаёт код. Сеты фестиваля — только role=admin (превью), пока не откроете всем.';
