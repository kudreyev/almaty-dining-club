create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  email text unique,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references users(id) on delete cascade,
  role text not null default 'user',
  phone text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  restaurant_name text,
  slug text not null unique,
  city text,
  district text,
  address text,
  phone text,
  instagram_url text,
  website_url text,
  two_gis_url text,
  cuisine text,
  cuisine_2 text,
  cuisine_3 text,
  description text,
  short_description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  title text not null,
  offer_title text,
  offer_type text,
  offer_terms_short text,
  description text,
  estimated_value integer,
  cooldown_days integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'active',
  plan_name text not null default 'standard',
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists activation_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  phone_target text not null,
  status text not null default 'issued' check (status in ('issued', 'activated', 'revoked', 'expired')),
  amount int not null default 1990,
  currency text not null default 'KZT',
  activated_user_id uuid references users(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  activation_link_id uuid references activation_links(id) on delete set null,
  token text,
  phone_target text,
  user_id uuid references users(id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  close_next_day boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists restaurant_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  address text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

create table if not exists restaurant_photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
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

create table if not exists redeem_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  offer_id uuid not null references offers(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  status text not null default 'active',
  issued_at timestamptz not null default now(),
  extend_deadline_at timestamptz not null default (now() + interval '1 hour'),
  extended_once boolean not null default false,
  redeemed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references redeem_tokens(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists staff_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  pin_code_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists staff_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table restaurants add column if not exists restaurant_name text;
alter table restaurants add column if not exists city text;
alter table restaurants add column if not exists district text;
alter table restaurants add column if not exists address text;
alter table restaurants add column if not exists phone text;
alter table restaurants add column if not exists instagram_url text;
alter table restaurants add column if not exists website_url text;
alter table restaurants add column if not exists two_gis_url text;
alter table restaurants add column if not exists cuisine text;
alter table restaurants add column if not exists cuisine_2 text;
alter table restaurants add column if not exists cuisine_3 text;
alter table restaurants add column if not exists short_description text;

alter table offers add column if not exists offer_title text;
alter table offers add column if not exists offer_type text;
alter table offers add column if not exists offer_terms_short text;

alter table restaurant_locations add column if not exists is_active boolean not null default true;
alter table restaurant_locations add column if not exists sort_order integer not null default 0;

update restaurants
set
  restaurant_name = coalesce(restaurant_name, name),
  city = coalesce(city, 'almaty'),
  short_description = coalesce(short_description, description, ''),
  address = coalesce(address, '')
where restaurant_name is null
   or city is null
   or short_description is null
   or address is null;

update offers
set
  offer_title = coalesce(offer_title, title),
  offer_type = coalesce(offer_type, '2for1'),
  offer_terms_short = coalesce(offer_terms_short, description, '')
where offer_title is null
   or offer_type is null
   or offer_terms_short is null;
