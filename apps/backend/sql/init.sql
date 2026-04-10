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

create table if not exists login_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  revoked_at timestamptz,
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

insert into restaurants (
  name,
  restaurant_name,
  slug,
  city,
  district,
  address,
  phone,
  instagram_url,
  website_url,
  two_gis_url,
  cuisine,
  cuisine_2,
  cuisine_3,
  description,
  short_description,
  is_active
)
values
  (
    'AUYL',
    'AUYL',
    'auyl',
    'almaty',
    'Медеуский район',
    'ул. Сатпаева 30/8, Алматы',
    '+77273111111',
    'https://instagram.com/auyl.almaty',
    null,
    null,
    'Казахская',
    'Авторская',
    null,
    'Современная казахская кухня в атмосферном пространстве.',
    'Современная казахская кухня и фирменные сеты.',
    true
  ),
  (
    'Vista',
    'Vista',
    'vista',
    'almaty',
    'Бостандыкский район',
    'пр. Абая 10А, Алматы',
    '+77273222222',
    'https://instagram.com/vista.almaty',
    null,
    null,
    'Европейская',
    'Завтраки',
    'Кофе',
    'Городское кафе с завтраками и десертами.',
    'Популярное кафе с завтраками и десертами весь день.',
    true
  ),
  (
    'Nori',
    'Nori',
    'nori',
    'almaty',
    'Алмалинский район',
    'ул. Толе би 55, Алматы',
    '+77273333333',
    'https://instagram.com/nori.almaty',
    null,
    null,
    'Японская',
    'Суши',
    null,
    'Небольшой ресторан японской кухни с роллами и раменом.',
    'Суши, роллы и рамен в центре Алматы.',
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  restaurant_name = excluded.restaurant_name,
  city = excluded.city,
  district = excluded.district,
  address = excluded.address,
  phone = excluded.phone,
  instagram_url = excluded.instagram_url,
  website_url = excluded.website_url,
  two_gis_url = excluded.two_gis_url,
  cuisine = excluded.cuisine,
  cuisine_2 = excluded.cuisine_2,
  cuisine_3 = excluded.cuisine_3,
  description = excluded.description,
  short_description = excluded.short_description,
  is_active = excluded.is_active;

insert into offers (
  restaurant_id,
  title,
  offer_title,
  offer_type,
  offer_terms_short,
  description,
  estimated_value,
  cooldown_days,
  is_active
)
select
  r.id,
  seed.offer_title,
  seed.offer_title,
  seed.offer_type,
  seed.offer_terms_short,
  seed.offer_terms_short,
  seed.estimated_value,
  seed.cooldown_days,
  true
from (
  values
    ('auyl', '2for1', '2 за 1 на чайную церемонию', 'При заказе чайной церемонии вторая бесплатно.', 9000, 30),
    ('vista', 'compliment', 'Десерт в подарок', 'При заказе основного блюда десерт от заведения.', 3500, 14),
    ('nori', '2for1', '2 за 1 на роллы', 'Каждый вторник второй сет роллов бесплатно.', 7000, 21)
) as seed(slug, offer_type, offer_title, offer_terms_short, estimated_value, cooldown_days)
join restaurants r on r.slug = seed.slug
where not exists (
  select 1
  from offers o
  where o.restaurant_id = r.id
    and coalesce(o.offer_title, o.title) = seed.offer_title
);

insert into restaurant_locations (
  restaurant_id,
  address,
  is_active,
  sort_order,
  lat,
  lng
)
select
  r.id,
  seed.address,
  true,
  0,
  seed.lat,
  seed.lng
from (
  values
    ('auyl', 'ул. Сатпаева 30/8, Алматы', 43.2332, 76.9553),
    ('vista', 'пр. Абая 10А, Алматы', 43.2385, 76.9451),
    ('nori', 'ул. Толе би 55, Алматы', 43.2567, 76.9288)
) as seed(slug, address, lat, lng)
join restaurants r on r.slug = seed.slug
where not exists (
  select 1
  from restaurant_locations rl
  where rl.restaurant_id = r.id
    and rl.sort_order = 0
);

insert into restaurant_hours (
  restaurant_id,
  day_of_week,
  is_closed,
  open_time,
  close_time,
  close_next_day
)
select
  r.id,
  seed.day_of_week,
  false,
  seed.open_time,
  seed.close_time,
  seed.close_next_day
from (
  values
    ('auyl', 1, '12:00', '23:00', false),
    ('auyl', 2, '12:00', '23:00', false),
    ('auyl', 3, '12:00', '23:00', false),
    ('auyl', 4, '12:00', '23:00', false),
    ('auyl', 5, '12:00', '00:00', true),
    ('auyl', 6, '12:00', '00:00', true),
    ('auyl', 7, '12:00', '23:00', false),
    ('vista', 1, '08:00', '22:00', false),
    ('vista', 2, '08:00', '22:00', false),
    ('vista', 3, '08:00', '22:00', false),
    ('vista', 4, '08:00', '22:00', false),
    ('vista', 5, '08:00', '23:00', false),
    ('vista', 6, '09:00', '23:00', false),
    ('vista', 7, '09:00', '22:00', false),
    ('nori', 1, '11:00', '22:00', false),
    ('nori', 2, '11:00', '22:00', false),
    ('nori', 3, '11:00', '22:00', false),
    ('nori', 4, '11:00', '22:00', false),
    ('nori', 5, '11:00', '23:00', false),
    ('nori', 6, '11:00', '23:00', false),
    ('nori', 7, '11:00', '22:00', false)
) as seed(slug, day_of_week, open_time, close_time, close_next_day)
join restaurants r on r.slug = seed.slug
where not exists (
  select 1
  from restaurant_hours rh
  where rh.restaurant_id = r.id
    and rh.day_of_week = seed.day_of_week
);
