#!/usr/bin/env node
/**
 * Генерирует public/sw.js из шаблона, подставляя CACHE_VERSION
 * (git SHA / Vercel commit / timestamp) — без ручного бампа.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const templatePath = join(__dirname, 'sw.template.js')
const outPath = join(root, 'public', 'sw.js')

function shortSha(value) {
  const sha = String(value).trim()
  return sha ? sha.slice(0, 12) : ''
}

function resolveCacheVersion() {
  const fromEnv =
    shortSha(process.env.VERCEL_GIT_COMMIT_SHA || '') ||
    shortSha(process.env.CF_PAGES_COMMIT_SHA || '') ||
    shortSha(process.env.GITHUB_SHA || '') ||
    String(process.env.KUDACLUB_SW_VERSION || '').trim()

  if (fromEnv) return `kudaclub-${fromEnv}`

  try {
    const gitSha = execSync('git rev-parse --short=12 HEAD', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (gitSha) return `kudaclub-${gitSha}`
  } catch {
    // not a git checkout / no git
  }

  return `kudaclub-dev-${Date.now()}`
}

const version = resolveCacheVersion()
const template = readFileSync(templatePath, 'utf8')

if (!template.includes('__CACHE_VERSION__')) {
  console.error('sw.template.js: missing __CACHE_VERSION__ placeholder')
  process.exit(1)
}

const output = template.replaceAll('__CACHE_VERSION__', version)
writeFileSync(outPath, output, 'utf8')
console.log(`[generate-sw] CACHE_VERSION=${version} → public/sw.js`)
