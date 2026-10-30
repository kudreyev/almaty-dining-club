import { PGlite } from '/tmp/kuda-sqltest/node_modules/@electric-sql/pglite/dist/index.js'
import { readFileSync } from 'node:fs'

const db = new PGlite()
let failures = 0

function check(name, cond, extra) {
  if (cond) console.log(`  PASS  ${name}`)
  else {
    failures += 1
    console.log(`  FAIL  ${name}`, extra === undefined ? '' : JSON.stringify(extra))
  }
}

async function asRole(role, sql, params = []) {
  await db.exec(`reset role; set role ${role}`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    phone text,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`)

await db.exec(`
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    phone text,
    role text not null default 'user',
    user_kind text not null default 'customer',
    created_at timestamptz not null default now()
  );
  create table public.restaurants (
    id uuid primary key default gen_random_uuid(),
    restaurant_name text not null,
    slug text not null,
    city text not null default 'almaty',
    is_active boolean not null default true
  );
  create table public.offers (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references public.restaurants(id),
    offer_type text not null default '2for1',
    offer_key text not null,
    offer_title text not null,
    estimated_value integer,
    is_active boolean not null default true
  );
  create table public.staff_users (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references public.restaurants(id),
    pin_code text not null default '0000'
  );
  create table public.redeem_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    restaurant_id uuid not null references public.restaurants(id),
    offer_id uuid not null references public.offers(id),
    token_code text not null unique,
    status text not null default 'redeemed',
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null default now(),
    extend_deadline_at timestamptz not null default now()
  );
  create table public.redemptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    restaurant_id uuid not null references public.restaurants(id),
    offer_id uuid not null references public.offers(id),
    redeem_token_id uuid not null references public.redeem_tokens(id),
    redeemed_at timestamptz not null default now()
  );
  create index redemptions_user_idx on public.redemptions (user_id, redeemed_at desc);
`)

const sql = readFileSync(
  new URL('../supabase/migrations/20261030120000_weekly_report.sql', import.meta.url),
  'utf8',
)
try {
  await db.exec(sql)
  console.log('  ok    migration')
} catch (error) {
  console.log('  FAIL  migration', error.message)
  process.exit(1)
}

const G1 = '11111111-1111-1111-1111-111111111111'
const G2 = '22222222-2222-2222-2222-222222222222'
const G3 = '33333333-3333-3333-3333-333333333333'
const STAFF = '44444444-4444-4444-4444-444444444444'
const ADMIN = '55555555-5555-5555-5555-555555555555'
const EXCL = '66666666-6666-6666-6666-666666666666'
const RET = '77777777-7777-7777-7777-777777777777'
const R1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const R2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const R0 = 'aaaaaaaa-0000-0000-0000-000000000003'
const O1 = 'bbbbbbbb-0000-0000-0000-000000000001'
const O2 = 'bbbbbbbb-0000-0000-0000-000000000002'

function token(id) {
  return id.replace(/-/g, '').slice(0, 12)
}

await db.exec(`
  insert into auth.users (id, email) values
    ('${G1}', 'g1@wa.local'),
    ('${G2}', 'g2@wa.local'),
    ('${G3}', 'g3@wa.local'),
    ('${STAFF}', 'staff@wa.local'),
    ('${ADMIN}', 'admin@wa.local'),
    ('${EXCL}', 'excl@wa.local'),
    ('${RET}', 'ret@wa.local');

  insert into public.profiles (id, phone, role, user_kind, created_at, utm_source, ref_code) values
    ('${G1}', '+77010000001', 'user', 'customer', '2026-09-01 10:00:00+05', 'instagram', null),
    ('${G2}', '+77010000002', 'user', 'customer', '2026-09-23 12:00:00+05', 'test', 'abc'),
    ('${G3}', '+77010000003', 'user', 'customer', '2026-09-24 18:00:00+05', null, null),
    ('${STAFF}', '+77010000004', 'user', 'staff', '2026-09-23 12:00:00+05', null, null),
    ('${ADMIN}', '+77010000005', 'admin', 'customer', '2026-09-23 12:00:00+05', null, null),
    ('${EXCL}', '+77010000006', 'user', 'customer', '2026-09-23 12:00:00+05', null, null),
    ('${RET}', '+77010000007', 'user', 'customer', '2026-08-01 10:00:00+05', null, null);

  insert into public.report_excluded_users (user_id, note) values ('${EXCL}', 'team');

  insert into public.restaurants (id, restaurant_name, slug, city, is_active) values
    ('${R1}', 'Антрекот', 'entrecote', 'almaty', true),
    ('${R2}', 'Unai', 'unai', 'almaty', true),
    ('${R0}', 'Кафе А', 'cafe-a', 'almaty', true);

  insert into public.offers (id, restaurant_id, offer_key, offer_title, estimated_value) values
    ('${O1}', '${R1}', 'steak', '2 стейка', 9000),
    ('${O2}', '${R2}', 'pizza', '2 пиццы', 5000);

  insert into public.redeem_tokens (id, user_id, restaurant_id, offer_id, token_code, status) values
    ('e0000000-0000-0000-0000-000000000001', '${G1}', '${R1}', '${O1}', '${token('1')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000002', '${G1}', '${R1}', '${O1}', '${token('2')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000003', '${G2}', '${R1}', '${O1}', '${token('3')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000004', '${G2}', '${R2}', '${O2}', '${token('4')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000005', '${STAFF}', '${R1}', '${O1}', '${token('5')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000006', '${ADMIN}', '${R1}', '${O1}', '${token('6')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000007', '${EXCL}', '${R1}', '${O1}', '${token('7')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000008', '${RET}', '${R1}', '${O1}', '${token('8')}', 'redeemed'),
    ('e0000000-0000-0000-0000-000000000009', '${RET}', '${R1}', '${O1}', '${token('9')}', 'redeemed'),
    ('e0000000-0000-0000-0000-00000000000a', '${G1}', '${R1}', '${O1}', '${token('a')}', 'active');

  -- Неделя 21–27 сентября 2026. Пт 25 сентября 19:30 Алматы — пик.
  insert into public.redemptions (user_id, restaurant_id, offer_id, redeem_token_id, redeemed_at) values
    ('${G1}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000001', '2026-09-25 19:30:00+05'),
    ('${G1}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000002', '2026-09-26 20:10:00+05'),
    ('${G2}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000003', '2026-09-25 19:45:00+05'),
    ('${G2}', '${R2}', '${O2}', 'e0000000-0000-0000-0000-000000000004', '2026-09-22 13:00:00+05'),
    ('${STAFF}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000005', '2026-09-25 19:00:00+05'),
    ('${ADMIN}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000006', '2026-09-25 19:00:00+05'),
    ('${EXCL}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000007', '2026-09-25 19:00:00+05'),
    ('${RET}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000008', '2026-08-05 18:00:00+05'),
    ('${RET}', '${R1}', '${O1}', 'e0000000-0000-0000-0000-000000000009', '2026-09-20 18:00:00+05');
`)

console.log('== get_weekly_report 2026-09-22')
const { rows } = await asRole(
  'service_role',
  `select public.get_weekly_report('2026-09-22') as r`,
)
const report = rows[0].r
const dumped = JSON.stringify(report)
check('week snapped to monday 2026-09-21', report.week.start === '2026-09-21', report.week)
check('week label', report.week.label === '21–27 сентября', report.week.label)

const direct = (
  await db.query(`
    select count(*)::int as redemptions, count(distinct r.user_id)::int as guests
    from public.redemptions r
    join public.profiles p on p.id = r.user_id
    where r.redeemed_at >= '2026-09-21 00:00:00+05'
      and r.redeemed_at < '2026-09-28 00:00:00+05'
      and p.phone is not null
      and coalesce(p.user_kind, 'customer') = 'customer'
      and coalesce(p.role, 'user') <> 'admin'
      and p.id not in (select user_id from public.report_excluded_users)
  `)
).rows[0]

check('redemptions match direct count', report.activity.redemptions === direct.redemptions, {
  report: report.activity.redemptions,
  direct: direct.redemptions,
})
check('weekly active match direct guests', report.activity.weekly_active === direct.guests, {
  report: report.activity.weekly_active,
  direct: direct.guests,
})
check('staff/admin/excluded not in redemptions', report.activity.redemptions === 4, report.activity)
check('new registered this week = 2 (G2,G3)', report.users.new === 2, report.users)
check('registered total as of week end = 4 (G1 G2 G3 RET)', report.users.registered_total === 4, report.users)
check('savings week = 9000*3 + 5000', Number(report.savings.week) === 32000, report.savings)
check('zero venue named', report.venues.zero_names.includes('Кафе А'), report.venues)
check('top venue Антрекот first', report.top_venues[0]?.name === 'Антрекот', report.top_venues)
check('Антрекот has 2 new guests (G1 first this week, G2 first this week)', report.top_venues[0]?.new_guests === 2, report.top_venues[0])
check('peak friday evening', report.peak?.label === 'пт 19–21 ч', report.peak)
check('channels include test and неизвестно', JSON.stringify(report.channels.combined).includes('test') && JSON.stringify(report.channels.combined).includes('неизвестно'), report.channels)
check('no phones in json', !dumped.includes('+7701'), dumped.slice(0, 80))
check('no guest ids in json', !dumped.includes(G1), 'contains uuid')
check('goals nearest 2026-11-30', report.goals.target_date === '2026-11-30', report.goals)

const jsonText = JSON.stringify(report, null, 2)
console.log('\n--- JSON get_weekly_report(2026-09-22) ---\n' + jsonText + '\n--- end ---\n')

console.log('== permissions')
async function expectDenied(label, role) {
  try {
    await asRole(role, `select public.get_weekly_report('2026-09-22')`)
    check(label, false, 'no error')
  } catch (error) {
    check(label, /permission denied/i.test(String(error.message)), error.message)
  }
}
await expectDenied('anon cannot execute', 'anon')
await expectDenied('authenticated cannot execute', 'authenticated')

console.log('== get_venue_report')
const venue = (
  await asRole(
    'service_role',
    `select public.get_venue_report($1::uuid, '2026-09-01'::date) as r`,
    [R1],
  )
).rows[0].r
check('venue report ok', venue.ok === true && venue.venue_name === 'Антрекот', venue)
check('venue September redemptions exclude tests', venue.redemptions === 4, venue)
check('venue no user ids', !JSON.stringify(venue).includes(G1), venue)

console.log('== default week_start is last complete monday')
const def = (await asRole('service_role', `select public.get_weekly_report() as r`)).rows[0].r
const expectedMonday = (
  await db.query(`select public.report_last_complete_monday(now())::text as d`)
).rows[0].d
check('default week start', def.week.start === expectedMonday, {
    got: def.week.start,
    expectedMonday,
  })
console.log('\n--- JSON get_weekly_report() last complete week ---\n' + JSON.stringify(def, null, 2) + '\n--- end ---\n')

if (failures) {
  console.log(`\n${failures} failed`)
  process.exit(1)
}
console.log('\nall passed')
