/**
 * Тестовый Web Push одному пользователю (без UI). Лимит 2/неделю и окно 11–21 соблюдаются.
 * Массовая рассылка — только через админку /admin/push или Edge Function send-push (dry_run по умолчанию).
 *
 * Пример:
 *   npx tsx scripts/send-push.ts --subscriber-id <uuid> --title "Пятница" --body "Куда сходить" --url /almaty
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
  if (hasFlag('--all')) {
    console.error('Массовая рассылка: Edge Function send-push или /admin/push.')
    process.exit(1)
  }
  const subscriberId = readArg('--subscriber-id')
  const title = readArg('--title')
  const body = readArg('--body')
  const url = readArg('--url')

  if (!subscriberId || !title || !body || !url) {
    usage()
  }

  const { sendPush } = await import('../src/lib/messaging/push-messaging')
  const result = await sendPush(subscriberId, { title, body, url, campaign: 'script-test' })
  console.log(
    JSON.stringify({ mode: 'subscriber', subscriberId, ...result }, null, 2),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
