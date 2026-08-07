#!/usr/bin/env node
/**
 * Генерирует пару VAPID-ключей для Web Push.
 *
 * Использование:
 *   node scripts/generate-vapid-keys.mjs
 *
 * Добавь вывод в .env.local / Vercel env:
 *   NEXT_PUBLIC_VAPID_KEY=...   (публичный, в браузер)
 *   VAPID_PRIVATE_KEY=...       (только сервер)
 *   VAPID_SUBJECT=mailto:ops@kudaclub.kz   (или https://kudaclub.kz)
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log(`
# Web Push VAPID (сгенерировано scripts/generate-vapid-keys.mjs)
NEXT_PUBLIC_VAPID_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_SUBJECT=mailto:ops@kudaclub.kz
`)
