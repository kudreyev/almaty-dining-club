import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/db/client'

const statements = [
  sql`create extension if not exists pgcrypto;`,
  sql`create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    phone text not null unique,
    email text,
    role text not null default 'user',
    created_at timestamptz not null default now()
  );`,
  sql`create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    token_hash text not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  );`,
  sql`create table if not exists profiles (
    id uuid primary key,
    role text not null default 'user',
    phone text,
    full_name text,
    created_at timestamptz not null default now()
  );`,
]

export async function migrate() {
  for (const statement of statements) {
    await db.execute(statement)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Base migration complete')
      process.exit(0)
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error)
      process.exit(1)
    })
}
