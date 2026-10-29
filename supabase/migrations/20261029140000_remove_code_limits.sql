-- Коды без лимитов: убираем паузу между использованиями оффера (cooldown_days)
-- и дневные лимиты (daily_limit). Остаются: вход + подтверждённый телефон,
-- один активный код одновременно, часы действия оффера, срок кода 10 минут.
--
-- Можно применять в любом порядке относительно деплоя: сигнатуры функций
-- не меняются, а старый код переживает отсутствие offer_daily_availability.
-- Колонки offers.cooldown_days, offers.daily_limit, restaurants.daily_limit
-- не удаляются (старый код админки их ещё читает), но больше ни на что не влияют.

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

  select o.id, o.end_date
  into v_offer
  from public.offers o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_offer_id
    and o.restaurant_id = p_restaurant_id
    and o.is_active
    and r.is_active;

  if not found
     or (v_offer.end_date is not null
         and v_offer.end_date < (v_now at time zone 'Asia/Almaty')::date) then
    return jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  end if;

  -- Один гость не получит два кода параллельно (двойной клик).
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

  v_expires_at := v_now + interval '10 minutes';

  loop
    v_attempt := v_attempt + 1;
    -- 6 цифр из криптостойкого gen_random_uuid().
    v_code := (
      ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 15))::bit(60)::bigint
      % 900000 + 100000
    )::text;

    begin
      insert into public.redeem_tokens (
        user_id,
        restaurant_id,
        offer_id,
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
      'token_id', v_token_id
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
  'Выдаёт код гостю: вход + подтверждённый телефон. Проверяет только активный код '
  'и часы действия оффера; паузы между использованиями и дневных лимитов нет.';

-- Продление живого кода на 10 минут (один раз, в течение часа после выдачи).
create or replace function public.extend_redeem_token(p_token_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_token record;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;

  select t.id, t.used_at, t.extended_once, t.extend_deadline_at
  into v_token
  from public.redeem_tokens t
  where t.id = p_token_id
    and t.user_id = v_user_id
    and t.status = 'active'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_token.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;
  if v_token.extended_once then
    return jsonb_build_object('ok', false, 'reason', 'already_extended');
  end if;
  if v_now > v_token.extend_deadline_at then
    return jsonb_build_object('ok', false, 'reason', 'extend_window_closed');
  end if;

  v_expires_at := v_now + interval '10 minutes';

  update public.redeem_tokens
  set expires_at = v_expires_at,
      extended_once = true
  where id = v_token.id;

  return jsonb_build_object('ok', true, 'expires_at', v_expires_at);
end;
$$;

drop function if exists public.offer_daily_availability(uuid[]);
drop function if exists public.redeem_codes_taken_today(uuid, uuid, timestamptz);
drop function if exists public.kuda_day_start(timestamptz);

comment on column public.offers.cooldown_days is
  'Не используется с 29.10.2026: паузы между использованиями оффера нет.';
comment on column public.offers.daily_limit is
  'Не используется с 29.10.2026: дневных лимитов кодов нет.';
comment on column public.restaurants.daily_limit is
  'Не используется с 29.10.2026: дневных лимитов кодов нет.';
