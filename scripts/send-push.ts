/**
 * Админ-рассылка Web Push (без UI).
 *
 * Примеры:
 *   npx tsx scripts/send-push.ts --subscriber-id <uuid> --title "Пятница" --body "Куда сходить" --url /almaty
 *   npx tsx scripts/send-push.ts --all --title "Пятница" --body "Куда сходить" --url https://kudaclub.kz/almaty
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      NEXT_PUBLIC_VAPID_KEY, VAPID_PRIVATE_KEY [, VAPID_SUBJECT]
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/send-push.ts --subscriber-id <uuid> --title "..." --body "..." --url <path|url>
  npx tsx scripts/send-push.ts --all --title "..." --body "..." --url <path|url>
`)
  process.exit(1)
}

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

async function main() {
  const all = hasFlag('--all')
  const subscriberId = readArg('--subscriber-id')
  const title = readArg('--title')
  const body = readArg('--body')
  const url = readArg('--url')

  if ((!all && !subscriberId) || (all && subscriberId) || !title || !body || !url) {
    usage()
  }

  const { sendPush, sendPushToAll } = await import('../src/lib/messaging/push-messaging')

  if (all) {
    const result = await sendPushToAll({ title, body, url })
    console.log(
      JSON.stringify({ mode: 'all', ...result }, null, 2),
    )
    return
  }

  const result = await sendPush(subscriberId!, { title, body, url })
  console.log(
    JSON.stringify({ mode: 'subscriber', subscriberId, ...result }, null, 2),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
