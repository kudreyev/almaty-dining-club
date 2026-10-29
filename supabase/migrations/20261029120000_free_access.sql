-- KudaClub становится бесплатным для гостей.
--
-- Доступ к кодам больше не зависит от подписки: достаточно зарегистрироваться
-- и подтвердить телефон (profiles.phone заполняется только после OTP).
-- Защита заведений от наплыва — настройками (daily_limit, cooldown_days,
-- offer_usable_hours), а выдача кода идёт через одну атомарную функцию.
--
-- Эту миграцию можно применять ДО деплоя нового кода: старые политики RLS она
-- не трогает. Закрытие прямой записи в redeem_tokens — в 20261029130000.

-- ---------------------------------------------------------------------------
-- 1) Профили: у всех существующих пользователей есть профиль с телефоном
-- ---------------------------------------------------------------------------
insert into public.profiles (id, phone, role)
select
  u.id,
  nullif(btrim(coalesce(u.raw_user_meta_data ->> 'phone_e164', u.phone)), ''),
  'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

update public.profiles p
set phone = nullif(btrim(u.raw_user_meta_data ->> 'phone_e164'), '')
from auth.users u
where u.id = p.id
  and p.phone is null
  and nullif(btrim(u.raw_user_meta_data ->> 'phone_e164'), '') is not null;

-- ---------------------------------------------------------------------------
-- 2) Основатели клуба: все, у кого когда-либо была оплаченная подписка
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_founder boolean not null default false;

comment on column public.profiles.is_founder is
  'Платил за подписку до перехода на бесплатную модель (бейдж «Основатель клуба»).';

with paid_users as (
  -- Продуктовые подписки: платные (не trial/staff), доступ реально выдавался.
  select s.user_id
  from public.subscriptions s
  where coalesce(s.plan_type, 'paid') = 'paid'
    and s.start_date is not null
    and s.status <> 'pending_payment'
  union
  -- Ручные оплаты Kaspi, подтверждённые админом.
  select pr.user_id
  from public.payment_requests pr
  where pr.status = 'approved'
  union
  -- Ledger TipTop: AccountId был UUID пользователя или телефоном.
  select p.id
  from public.subscribers sb
  join public.profiles p
    on sb.ttp_account_id = p.id::text
    or (p.phone is not null and sb.ttp_account_id = p.phone)
  where exists (
    select 1
    from public.payments pm
    where pm.subscriber_id = sb.id
      and pm.status = 'success'
      and pm.amount > 0
  )
)
update public.profiles p
set is_founder = true
from paid_users u
where u.user_id = p.id
  and p.is_founder = false
  and coalesce(p.user_kind, 'customer') = 'customer';

-- ---------------------------------------------------------------------------
-- 3) Старые подписки → cancelled (строки остаются для истории и возвратов)
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists status_before_free text;

comment on column public.subscriptions.status_before_free is
  'Статус подписки на момент перехода на бесплатную модель (2026-10-29).';

update public.subscriptions
set status_before_free = status
where status_before_free is null;

update public.subscriptions
set status = 'cancelled'
where status <> 'cancelled';

update public.subscribers
set status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now()),
    updated_at = now()
where status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- 4) Один аккаунт на один номер
-- ---------------------------------------------------------------------------
-- auth уже гарантирует это через синтетический email wa_<цифры>@wa.local;
-- индекс дополнительно страхует profiles. При дублях индекс не создаётся.
do $$
begin
  if exists (
    select 1
    from public.profiles
    where phone is not null
    group by public.normalize_phone_digits(phone)
    having count(*) > 1
  ) then
    raise notice
      'profiles.phone: найдены дубли, уникальный индекс не создан. '
      'Проверьте: select public.normalize_phone_digits(phone), count(*) '
      'from public.profiles where phone is not null group by 1 having count(*) > 1;';
  else
    create unique index if not exists profiles_phone_digits_uidx
      on public.profiles (public.normalize_phone_digits(phone))
      where phone is not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Дневные лимиты кодов (null = без лимита)
-- ---------------------------------------------------------------------------
alter table public.offers
  add column if not exists daily_limit integer;
alter table public.offers
  drop constraint if exists offers_daily_limit_positive;
alter table public.offers
  add constraint offers_daily_limit_positive
  check (daily_limit is null or daily_limit > 0);

comment on column public.offers.daily_limit is
  'Сколько кодов на этот оффер можно выдать за день (Asia/Almaty). null — без лимита.';

alter table public.restaurants
  add column if not exists daily_limit integer;
alter table public.restaurants
  drop constraint if exists restaurants_daily_limit_positive;
alter table public.restaurants
  add constraint restaurants_daily_limit_positive
  check (daily_limit is null or daily_limit > 0);

comment on column public.restaurants.daily_limit is
  'Сколько кодов на все офферы заведения можно выдать за день (Asia/Almaty). null — без лимита.';

create index if not exists redeem_tokens_offer_issued_idx
  on public.redeem_tokens (offer_id, issued_at desc);
create index if not exists redeem_tokens_restaurant_issued_idx
  on public.redeem_tokens (restaurant_id, issued_at desc);
create index if not exists redemptions_user_offer_idx
  on public.redemptions (user_id, offer_id, redeemed_at desc);

-- ---------------------------------------------------------------------------
-- 6) Хелперы доступности
-- ---------------------------------------------------------------------------

-- Начало текущих суток по Алматы.
create or replace function public.kuda_day_start(p_now timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('day', p_now at time zone 'Asia/Almaty') at time zone 'Asia/Almaty';
$$;

-- Коды, которые «занимают» дневной лимит: погашенные сегодня или ещё живые.
-- Истёкшие неиспользованные коды место не занимают.
create or replace function public.redeem_codes_taken_today(
  p_restaurant_id uuid,
  p_offer_id uuid default null,
  p_now timestamptz default now()
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.redeem_tokens t
  where t.restaurant_id = p_restaurant_id
    and (p_offer_id is null or t.offer_id = p_offer_id)
    and t.issued_at >= public.kuda_day_start(p_now)
    and (
      t.status = 'redeemed'
      or (t.status = 'active' and t.used_at is null and t.expires_at > p_now)
    );
$$;

-- Часы действия оффера (offer_usable_hours), та же логика, что в src/lib/offers.ts.
create or replace function public.offer_is_usable_now(
  p_offer_id uuid,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with local_now as (
    select
      extract(isodow from p_now at time zone 'Asia/Almaty')::int as dow,
      ((extract(isodow from p_now at time zone 'Asia/Almaty')::int + 5) % 7) + 1 as prev_dow,
      (p_now at time zone 'Asia/Almaty')::time as tod
  ),
  sched as (
    select h.*
    from public.offer_usable_hours h
    where h.offer_id = p_offer_id
      and h.is_unavailable = false
      and h.from_time is not null
      and h.to_time is not null
  )
  select
    not exists (select 1 from sched)
    or exists (
      select 1
      from sched s
      cross join local_now n
      where (
          s.day_of_week = n.dow
          and n.tod >= s.from_time
          and (s.to_next_day or n.tod < s.to_time)
        )
        or (
          s.day_of_week = n.prev_dow
          and s.to_next_day
          and n.tod < s.to_time
        )
    );
$$;

-- Остаток кодов на сегодня для каталога (без персональных данных).
-- remaining_today = null — лимита нет.
create or replace function public.offer_daily_availability(p_offer_ids uuid[])
returns table (offer_id uuid, remaining_today integer, sold_out boolean)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select
      o.id,
      o.restaurant_id,
      o.daily_limit as offer_limit,
      r.daily_limit as restaurant_limit
    from public.offers o
    join public.restaurants r on r.id = o.restaurant_id
    where o.id = any (p_offer_ids)
      and o.is_active
      and r.is_active
  ),
  remaining as (
    select
      t.id,
      case
        when t.offer_limit is null and t.restaurant_limit is null then null
        else greatest(
          0,
          least(
            coalesce(
              t.offer_limit - public.redeem_codes_taken_today(t.restaurant_id, t.id),
              2147483647
            ),
            coalesce(
              t.restaurant_limit - public.redeem_codes_taken_today(t.restaurant_id, null),
              2147483647
            )
          )
        )
      end::int as remaining_today
    from target t
  )
  select id, remaining_today, coalesce(remaining_today = 0, false)
  from remaining;
$$;

-- ---------------------------------------------------------------------------
-- 7) Выдача кода: регистрация + телефон, без проверок оплаты
-- ---------------------------------------------------------------------------
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
  v_cooldown_days int;
  v_last_redeemed_at timestamptz;
  v_taken int;
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

  select
    o.id,
    o.restaurant_id,
    o.cooldown_days,
    o.daily_limit,
    o.end_date,
    r.daily_limit as restaurant_daily_limit
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

  -- Сериализация: один гость не получит два кода параллельно,
  -- дневной лимит заведения не превысится гонкой.
  perform pg_advisory_xact_lock(hashtextextended('kuda_redeem_user:' || v_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('kuda_redeem_restaurant:' || p_restaurant_id::text, 0));

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

  v_cooldown_days := case
    when v_offer.cooldown_days is null or v_offer.cooldown_days < 1 then 7
    else v_offer.cooldown_days
  end;

  select max(rd.redeemed_at)
  into v_last_redeemed_at
  from public.redemptions rd
  where rd.user_id = v_user_id
    and rd.offer_id = p_offer_id
    and rd.redeemed_at > v_now - make_interval(days => v_cooldown_days);

  if v_last_redeemed_at is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'cooldown',
      'cooldown_days', v_cooldown_days,
      'available_at', v_last_redeemed_at + make_interval(days => v_cooldown_days)
    );
  end if;

  if v_offer.daily_limit is not null then
    v_taken := public.redeem_codes_taken_today(p_restaurant_id, p_offer_id, v_now);
    if v_taken >= v_offer.daily_limit then
      return jsonb_build_object('ok', false, 'reason', 'daily_limit');
    end if;
  end if;

  if v_offer.restaurant_daily_limit is not null then
    v_taken := public.redeem_codes_taken_today(p_restaurant_id, null, v_now);
    if v_taken >= v_offer.restaurant_daily_limit then
      return jsonb_build_object('ok', false, 'reason', 'daily_limit');
    end if;
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
  'Выдаёт код гостю: вход + подтверждённый телефон, без оплаты. Проверяет активный код, '
  'часы оффера, cooldown_days (по умолчанию 7), daily_limit оффера и заведения.';

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
  v_offer_limit int;
  v_restaurant_limit int;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;

  select
    t.id,
    t.restaurant_id,
    t.offer_id,
    t.used_at,
    t.expires_at,
    t.extended_once,
    t.extend_deadline_at
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

  -- Истёкший код освободил место в дневном лимите: вернуть его можно, только если место есть.
  if v_token.expires_at <= v_now then
    perform pg_advisory_xact_lock(
      hashtextextended('kuda_redeem_restaurant:' || v_token.restaurant_id::text, 0)
    );

    select o.daily_limit, r.daily_limit
    into v_offer_limit, v_restaurant_limit
    from public.offers o
    join public.restaurants r on r.id = o.restaurant_id
    where o.id = v_token.offer_id;

    if (v_offer_limit is not null
        and public.redeem_codes_taken_today(v_token.restaurant_id, v_token.offer_id, v_now) >= v_offer_limit)
       or (v_restaurant_limit is not null
        and public.redeem_codes_taken_today(v_token.restaurant_id, null, v_now) >= v_restaurant_limit) then
      return jsonb_build_object('ok', false, 'reason', 'daily_limit');
    end if;
  end if;

  v_expires_at := v_now + interval '10 minutes';

  update public.redeem_tokens
  set expires_at = v_expires_at,
      extended_once = true
  where id = v_token.id;

  return jsonb_build_object('ok', true, 'expires_at', v_expires_at);
end;
$$;

-- Supabase по умолчанию выдаёт EXECUTE ролям anon/authenticated: отзываем явно.
revoke all on function public.kuda_day_start(timestamptz) from public, anon, authenticated;
revoke all on function public.redeem_codes_taken_today(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.offer_is_usable_now(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.offer_daily_availability(uuid[]) from public;
revoke all on function public.issue_redeem_token(uuid, uuid) from public, anon;
revoke all on function public.extend_redeem_token(uuid) from public, anon;

grant execute on function public.offer_daily_availability(uuid[]) to anon, authenticated, service_role;
grant execute on function public.issue_redeem_token(uuid, uuid) to authenticated, service_role;
grant execute on function public.extend_redeem_token(uuid) to authenticated, service_role;
grant execute on function public.kuda_day_start(timestamptz) to service_role;
grant execute on function public.redeem_codes_taken_today(uuid, uuid, timestamptz) to service_role;
grant execute on function public.offer_is_usable_now(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 8) Журнал страховочной отмены подписок TipTop (Edge Function)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_cancel_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  dry_run boolean not null,
  tiptop_subscription_id text,
  user_id uuid references auth.users (id) on delete set null,
  account_id text,
  status_before text,
  result text not null
    check (result in ('would_cancel', 'cancelled', 'skipped', 'error')),
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_cancel_log_run_idx
  on public.subscription_cancel_log (run_id, created_at);
create index if not exists subscription_cancel_log_sub_idx
  on public.subscription_cancel_log (tiptop_subscription_id);

alter table public.subscription_cancel_log enable row level security;

drop policy if exists "subscription_cancel_log_admin_read" on public.subscription_cancel_log;
create policy "subscription_cancel_log_admin_read"
  on public.subscription_cancel_log for select to authenticated
  using (public.is_profile_admin(auth.uid()));

comment on table public.subscription_cancel_log is
  'Результаты cancel-all-subscriptions: что нашли в TipTop и что отменили. Пишет только service_role.';

-- ---------------------------------------------------------------------------
-- 9) Дневной снимок метрик: показатели бесплатной модели.
--    Подписочные колонки (mrr_kzt, active_subscribers, …) остаются для истории.
-- ---------------------------------------------------------------------------
alter table public.metrics_daily_snapshot
  add column if not exists members_total int not null default 0,
  add column if not exists new_members_24h int not null default 0,
  add column if not exists codes_issued_24h int not null default 0;

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);
