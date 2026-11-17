/**
 * Локальная проверка модели фестиваля (после supabase db reset / migrate).
 * Запуск: node scripts/verify-festival.mjs
 *
 * Требует DATABASE_URL или SUPABASE_DB_URL.
 */
import pg from 'pg'

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!url) {
  console.error('Set DATABASE_URL or SUPABASE_DB_URL')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()

const results = []

async function check(name, fn) {
  try {
    const ok = await fn()
    results.push({ name, ok: Boolean(ok), detail: ok === true ? 'ok' : String(ok) })
  } catch (error) {
    results.push({ name, ok: false, detail: error.message })
  }
}

await check('testfest event exists', async () => {
  const { rows } = await client.query(
    `select id from public.events where slug = 'testfest-today' and is_published`,
  )
  return rows.length === 1
})

await check('venue A has club + set', async () => {
  const { rows } = await client.query(`
    select
      count(*) filter (where o.offer_type in ('2for1','compliment')) as club,
      count(*) filter (where o.offer_type = 'set') as sets
    from public.restaurants r
    join public.offers o on o.restaurant_id = r.id and o.is_active
    where r.slug = 'testfest-cafe-a'
  `)
  return Number(rows[0].club) >= 1 && Number(rows[0].sets) >= 1
})

await check('venue B is set-only', async () => {
  const { rows } = await client.query(`
    select
      count(*) filter (where o.offer_type in ('2for1','compliment')) as club,
      count(*) filter (where o.offer_type = 'set') as sets
    from public.restaurants r
    join public.offers o on o.restaurant_id = r.id and o.is_active
    where r.slug = 'testfest-cafe-b'
  `)
  return Number(rows[0].club) === 0 && Number(rows[0].sets) >= 1
})

await check('club partner helper', async () => {
  const { rows } = await client.query(`
    select
      public.restaurant_is_club_partner(a.id) as a_partner,
      public.restaurant_is_club_partner(b.id) as b_partner
    from public.restaurants a, public.restaurants b
    where a.slug = 'testfest-cafe-a' and b.slug = 'testfest-cafe-b'
  `)
  return rows[0].a_partner === true && rows[0].b_partner === false
})

await check('set usable only in window', async () => {
  const { rows } = await client.query(`
    select o.id
    from public.offers o
    join public.restaurants r on r.id = o.restaurant_id
    where r.slug = 'testfest-cafe-a' and o.offer_type = 'set'
    limit 1
  `)
  const offerId = rows[0].id
  // Monday 10:00 Almaty — inside 08–12
  const inside = await client.query(
    `select public.offer_is_usable_now($1::uuid, timestamptz '2026-11-16 10:00:00+05') as ok`,
    [offerId],
  )
  // Monday 15:00 — outside
  const outside = await client.query(
    `select public.offer_is_usable_now($1::uuid, timestamptz '2026-11-16 15:00:00+05') as ok`,
    [offerId],
  )
  return inside.rows[0].ok === true && outside.rows[0].ok === false
})

await check('no kudafest_set leftover', async () => {
  const { rows } = await client.query(
    `select count(*)::int as n from public.offers where offer_type = 'kudafest_set'`,
  )
  return rows[0].n === 0
})

await client.end()

for (const row of results) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.name}${row.ok ? '' : ` — ${row.detail}`}`)
}

const failed = results.filter((r) => !r.ok)
process.exit(failed.length ? 1 : 0)
