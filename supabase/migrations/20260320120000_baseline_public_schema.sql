-- Baseline schema for public tables referenced by the app but missing historical CREATEs in repo.
--
-- Источник: реконструкция по TypeScript/серверным экшенам и существующим миграциям.
-- Это НЕ замена `supabase db dump` / `pg_dump` — перед продакшеном сверьте с реальной БД
-- (Dashboard → SQL / Schema, или `supabase link` + `supabase db dump --schema public`).
--
-- Порядок: таблицы по FK → индексы → RLS → политики.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email text,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- restaurants (price_level сделан nullable логикой 20260415195000)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  slug text not null,
  city text not null default 'almaty',
  address text not null default '',
  phone text,
  whatsapp_phone text,
  instagram_url text,
  website_url text,
  two_gis_url text,
  cuisine text not null default '',
  cuisine_2 text,
  cuisine_3 text,
  tags text[] not null default '{}',
  external_rating numeric(3, 1),
  external_reviews_count integer,
  is_active boolean not null default true,
  price_level text,
  created_at timestamptz not null default now(),
  constraint restaurants_external_rating_range
    check (external_rating is null or (external_rating >= 1.0 and external_rating <= 5.0)),
  constraint restaurants_external_reviews_count_nonneg
    check (external_reviews_count is null or external_reviews_count >= 0)
);

create unique index if not exists restaurants_slug_uidx on public.restaurants (slug);
create index if not exists restaurants_city_active_idx on public.restaurants (city, is_active);

-- ---------------------------------------------------------------------------
-- payment_requests
-- ---------------------------------------------------------------------------
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payment_code text not null,
  amount integer not null check (amount > 0),
  status text not null
    check (status in ('pending', 'approved', 'rejected')),
  comment_from_user text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  admin_comment text
);

create index if not exists payment_requests_user_id_idx on public.payment_requests (user_id);
create index if not exists payment_requests_status_submitted_idx
  on public.payment_requests (status, submitted_at desc);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null
    check (status in ('inactive', 'pending_payment', 'active', 'expired')),
  plan_name text not null default 'monthly_almaty',
  start_date date,
  end_date date,
  payment_request_id uuid references public.payment_requests (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  offer_type text not null default '2for1',
  offer_key text not null,
  offer_title text not null,
  offer_terms_short text not null default '',
  offer_terms_full text not null default '',
  estimated_value integer,
  cooldown_days integer,
  dish_photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint offers_unique_key_per_restaurant unique (restaurant_id, offer_key)
);

create index if not exists offers_restaurant_active_idx
  on public.offers (restaurant_id, is_active);

-- ---------------------------------------------------------------------------
-- restaurant_hours (close_next_day из 20260406143000)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  close_next_day boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (is_closed = true and open_time is null and close_time is null)
    or (is_closed = false and open_time is not null and close_time is not null)
  )
);

create index if not exists restaurant_hours_restaurant_day_idx
  on public.restaurant_hours (restaurant_id, day_of_week);

-- ---------------------------------------------------------------------------
-- restaurant_locations
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  address text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_locations_restaurant_sort_idx
  on public.restaurant_locations (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- restaurant_photos (варианты thumb/full из 20260407120000)
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  public_url text not null,
  storage_path text not null,
  thumb_url text not null,
  full_url text not null,
  thumb_path text not null,
  full_path text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_photos_restaurant_sort_idx
  on public.restaurant_photos (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- staff_users (PIN персонала; чтение с anon в приложении — см. docs/db-schema.md)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_name text not null default 'Администратор',
  pin_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists staff_users_restaurant_idx on public.staff_users (restaurant_id);

-- ---------------------------------------------------------------------------
-- redeem_tokens
-- ---------------------------------------------------------------------------
create table if not exists public.redeem_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete restrict,
  token_code text not null,
  status text not null check (status in ('active', 'redeemed', 'expired', 'cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  extend_deadline_at timestamptz not null,
  extended_once boolean not null default false,
  used_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by_staff_id uuid references public.staff_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint redeem_tokens_token_code_uidx unique (token_code)
);

create index if not exists redeem_tokens_user_status_idx on public.redeem_tokens (user_id, status);
create index if not exists redeem_tokens_code_idx on public.redeem_tokens (token_code);

-- ---------------------------------------------------------------------------
-- redemptions
-- ---------------------------------------------------------------------------
create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete restrict,
  redeem_token_id uuid not null references public.redeem_tokens (id) on delete restrict,
  staff_user_id uuid references public.staff_users (id) on delete set null,
  redeemed_at timestamptz not null default now()
);

create index if not exists redemptions_user_idx on public.redemptions (user_id, redeemed_at desc);
create index if not exists redemptions_offer_idx on public.redemptions (offer_id, redeemed_at desc);

-- ---------------------------------------------------------------------------
-- activation_links (дублирует последующую миграцию с IF NOT EXISTS — безопасно)
-- ---------------------------------------------------------------------------
create table if not exists public.activation_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  phone_target text not null,
  status text not null default 'issued'
    check (status in ('issued', 'activated', 'revoked', 'expired')),
  amount int not null default 1990,
  currency text not null default 'KZT',
  activated_user_id uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists activation_links_token_idx on public.activation_links (token);
create index if not exists activation_links_created_at_idx on public.activation_links (created_at desc);

-- ---------------------------------------------------------------------------
-- analytics_events (финальная форма после drop token — 20260514110000)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  activation_link_id uuid references public.activation_links (id) on delete set null,
  phone_target text,
  user_id uuid references auth.users (id) on delete set null,
  meta jsonb,
  token_hash text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx on public.analytics_events (event_name);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_activation_link_id_idx
  on public.analytics_events (activation_link_id);
create index if not exists analytics_events_token_hash_idx
  on public.analytics_events (token_hash)
  where token_hash is not null;

-- ---------------------------------------------------------------------------
-- staff_sessions (cookie staff; только service_role в коде)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_sessions_token_hash_uidx on public.staff_sessions (session_token_hash);
create index if not exists staff_sessions_restaurant_id_idx on public.staff_sessions (restaurant_id);
create index if not exists staff_sessions_expires_at_idx on public.staff_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- payment_admin_audit, rate limit (как в поздних миграциях)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_admin_audit (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('approve', 'reject', 'amount_edit')),
  payment_request_id uuid not null,
  actor_user_id uuid not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_admin_audit_payment_request_id_idx
  on public.payment_admin_audit (payment_request_id desc);
create index if not exists payment_admin_audit_created_at_idx
  on public.payment_admin_audit (created_at desc);

create table if not exists public.redeem_rate_failures (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null,
  event_kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists redeem_rate_failures_key_created_idx
  on public.redeem_rate_failures (key_hash, created_at desc);

create table if not exists public.redeem_rate_blocks (
  key_hash text primary key,
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.payment_requests enable row level security;
alter table public.subscriptions enable row level security;
alter table public.offers enable row level security;
alter table public.restaurant_hours enable row level security;
alter table public.restaurant_locations enable row level security;
alter table public.restaurant_photos enable row level security;
alter table public.staff_users enable row level security;
alter table public.redeem_tokens enable row level security;
alter table public.redemptions enable row level security;
alter table public.activation_links enable row level security;
alter table public.analytics_events enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.payment_admin_audit enable row level security;
alter table public.redeem_rate_failures enable row level security;
alter table public.redeem_rate_blocks enable row level security;

-- ---------------------------------------------------------------------------
-- Policies: проверка admin без рекурсивного RLS на profiles
-- ---------------------------------------------------------------------------
create or replace function public.is_profile_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

revoke all on function public.is_profile_admin(uuid) from public;
grant execute on function public.is_profile_admin(uuid) to anon, authenticated, service_role;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- restaurants: публичное чтение активных; админы — полный доступ
drop policy if exists "restaurants_public_read_active" on public.restaurants;
create policy "restaurants_public_read_active"
  on public.restaurants for select to public
  using (is_active = true);

drop policy if exists "restaurants_admin_select" on public.restaurants;
drop policy if exists "restaurants_admin_all" on public.restaurants;
create policy "restaurants_admin_all"
  on public.restaurants for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- offers
drop policy if exists "offers_public_read" on public.offers;
create policy "offers_public_read"
  on public.offers for select to public
  using (
    is_active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = offers.restaurant_id and r.is_active = true
    )
  );

drop policy if exists "offers_admin_all" on public.offers;
create policy "offers_admin_all"
  on public.offers for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- restaurant_hours (логика как в 20260406110000 + возможность правок админом)
drop policy if exists "restaurant_hours_public_active_restaurants" on public.restaurant_hours;
create policy "restaurant_hours_public_active_restaurants"
  on public.restaurant_hours for select to public
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_hours.restaurant_id and r.is_active = true
    )
  );

drop policy if exists "restaurant_hours_admin_all" on public.restaurant_hours;
create policy "restaurant_hours_admin_all"
  on public.restaurant_hours for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- restaurant_locations
drop policy if exists "restaurant_locations_public_read" on public.restaurant_locations;
create policy "restaurant_locations_public_read"
  on public.restaurant_locations for select to public
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = restaurant_locations.restaurant_id and r.is_active = true
    )
  );

drop policy if exists "restaurant_locations_admin_all" on public.restaurant_locations;
create policy "restaurant_locations_admin_all"
  on public.restaurant_locations for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- restaurant_photos
drop policy if exists "restaurant_photos_public_read" on public.restaurant_photos;
create policy "restaurant_photos_public_read"
  on public.restaurant_photos for select to public
  using (
    is_active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_photos.restaurant_id and r.is_active = true
    )
  );

drop policy if exists "restaurant_photos_admin_all" on public.restaurant_photos;
create policy "restaurant_photos_admin_all"
  on public.restaurant_photos for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- payment_requests
drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_insert_own"
  on public.payment_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "payment_requests_select_own" on public.payment_requests;
create policy "payment_requests_select_own"
  on public.payment_requests for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "payment_requests_admin_all" on public.payment_requests;
create policy "payment_requests_admin_all"
  on public.payment_requests for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- subscriptions: пользователь видит свои строки
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

-- staff_users — анонимные запросы из staff/login и staff/redeem (anon key).
-- ВНИМАНИЕ: ограничение только запросами приложения; усилить — перевести на service_role/RPC.
drop policy if exists "staff_users_select_active" on public.staff_users;
create policy "staff_users_select_active"
  on public.staff_users for select to public
  using (is_active = true);

drop policy if exists "staff_users_admin_all" on public.staff_users;
create policy "staff_users_admin_all"
  on public.staff_users for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- redeem_tokens: владелец (подписчик) + сценарий персонала без auth user (anon UPDATE)
drop policy if exists "redeem_tokens_authenticated_owner" on public.redeem_tokens;
create policy "redeem_tokens_authenticated_owner"
  on public.redeem_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "redeem_tokens_anon_staff_mutation" on public.redeem_tokens;
create policy "redeem_tokens_anon_staff_mutation"
  on public.redeem_tokens for update to anon
  using (true)
  with check (true);

-- redemptions: владелец видит историю; вставка при списании — с anon (staff)
drop policy if exists "redemptions_select_own" on public.redemptions;
create policy "redemptions_select_own"
  on public.redemptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "redemptions_anon_staff_insert" on public.redemptions;
create policy "redemptions_anon_staff_insert"
  on public.redemptions for insert to anon
  with check (true);

drop policy if exists "redemptions_admin_all" on public.redemptions;
create policy "redemptions_admin_all"
  on public.redemptions for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- activation_links & analytics_events — как в ранних миграциях
drop policy if exists "activation_links_admins_all" on public.activation_links;
create policy "activation_links_admins_all"
  on public.activation_links for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

drop policy if exists "analytics_events_admins_all" on public.analytics_events;
create policy "analytics_events_admins_all"
  on public.analytics_events for all to authenticated
  using (public.is_profile_admin(auth.uid()))
  with check (public.is_profile_admin(auth.uid()));

-- staff_sessions, payment_admin_audit, rate limit: нет end-user политик
comment on table public.payment_admin_audit is
  'Inserts via service_role / server after admin auth; no end-user policies.';
comment on table public.redeem_rate_failures is
  'Append-only; written via service_role after failed staff redeem/PIN checks.';
comment on table public.redeem_rate_blocks is
  'Active blocks per key_hash; read/write via service_role from server.';
