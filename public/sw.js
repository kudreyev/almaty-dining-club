/* KudaClub PWA service worker — app shell + офлайн-каталог + Web Push.
 * CACHE_VERSION подставляется при сборке (git SHA / deploy id).
 * Новая версия ждёт (waiting), пока пользователь не нажмёт «Обновить» в плашке:
 * страница шлёт postMessage({ type: 'SKIP_WAITING' }) и перезагружается.
 */
const CACHE_VERSION = 'kudaclub-532bf8f49150'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const PAGES_CACHE = `${CACHE_VERSION}-pages`

const PRECACHE_URLS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/apple-touch-icon.png',
]

const CATALOG_CITIES = ['almaty', 'astana']
const CITY_LABELS = { almaty: 'Алматы', astana: 'Астана' }

/** Код живёт 10 минут: экран кода, кабинет и персонал — только из сети, никогда из кэша. */
function isNetworkOnlyPath(path) {
  return (
    path.startsWith('/api/') ||
    path === '/app' ||
    path.startsWith('/app/') ||
    path === '/staff' ||
    path.startsWith('/staff/') ||
    path === '/login' ||
    path.startsWith('/login/') ||
    path.startsWith('/auth/')
  )
}

function isCodePath(path) {
  return path === '/app' || path.startsWith('/app/')
}

function isAppShellAsset(url) {
  const path = url.pathname
  if (path.startsWith('/_next/static/')) return true
  if (path.startsWith('/icons/')) return true
  if (path === '/apple-touch-icon.png' || path === '/favicon.ico') return true
  return /\.(?:js|css|woff2?|ttf|otf|png|svg|webp|ico)$/i.test(path)
}

function isOfflineableCatalog(url) {
  const path = url.pathname.replace(/\/$/, '') || '/'
  return CATALOG_CITIES.some((city) => path === `/${city}`)
}

async function cachePut(cacheName, request, response) {
  if (!response || !response.ok) return
  if (response.type !== 'basic' && response.type !== 'cors') return
  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE)
  const url = new URL(request.url)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) {
      await cache.put(request, fresh.clone())
      // Дублируем без query — офлайн-фоллбэк для /almaty?utm=… → /almaty
      if (url.search) {
        await cache.put(url.pathname, fresh.clone())
      }
    }
    return fresh
  } catch {
    const cached =
      (await cache.match(request)) ||
      (url.search ? await cache.match(url.pathname) : undefined)
    if (cached) return cached
    throw new Error('offline-miss')
  }
}

async function cacheFirstShell(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const fresh = await fetch(request)
  await cachePut(SHELL_CACHE, request, fresh)
  return fresh
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

async function offlinePage(path) {
  const cache = await caches.open(PAGES_CACHE)
  const cities = []
  for (const city of CATALOG_CITIES) {
    if (await cache.match(`/${city}`)) cities.push(city)
  }
  const title = isCodePath(path) ? 'Нужен интернет, чтобы получить код.' : 'Нет подключения к интернету.'
  const text = cities.length
    ? 'Каталог доступен офлайн.'
    : 'Каталог откроется, когда появится сеть.'
  const links = cities
    .map(
      (city) =>
        `<a href="/${city}" style="display:block;margin-top:12px;padding:14px;border-radius:12px;background:#D85A30;color:#fff;text-decoration:none;font-weight:600">Каталог: ${escapeHtml(CITY_LABELS[city])}</a>`,
    )
    .join('')
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#D85A30"><title>Нет сети — KudaClub</title></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:#fafaf9;color:#171717"><main style="max-width:420px;margin:0 auto;padding:calc(48px + env(safe-area-inset-top)) 24px 24px;text-align:center"><div style="font-size:20px;font-weight:600">Kuda<span style="color:#D85A30">club</span></div><h1 style="font-size:22px;margin:32px 0 8px">${escapeHtml(title)}</h1><p style="margin:0;color:#525252">${escapeHtml(text)}</p>${links}<button onclick="location.reload()" style="margin-top:16px;width:100%;padding:14px;border-radius:12px;border:1px solid #d4d4d4;background:#fff;font-size:15px">Повторить</button></main></body></html>`
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await cache.addAll(PRECACHE_URLS)
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    if (isOfflineableCatalog(url)) {
      event.respondWith(networkFirstPage(request).catch(() => offlinePage(url.pathname)))
      return
    }
    // Остальные страницы (и экран кода) — только сеть; без сети — честная заглушка.
    event.respondWith(fetch(request).catch(() => offlinePage(url.pathname)))
    return
  }

  if (isNetworkOnlyPath(url.pathname)) return

  if (isAppShellAsset(url)) {
    event.respondWith(cacheFirstShell(request))
  }
})

/* ── Web Push ─────────────────────────────────────────────── */

function buildClickUrl(rawUrl, campaign) {
  try {
    const url = new URL(rawUrl || '/', self.location.origin)
    if (url.origin !== self.location.origin) return url.href
    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'push')
    if (campaign && !url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', campaign)
    url.searchParams.set('push_click', '1')
    return url.href
  } catch {
    return `${self.location.origin}/?utm_source=push&push_click=1`
  }
}

function trackFromWorker(event, params) {
  return fetch('/api/track', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, params, page: 'sw' }),
  }).catch(() => {})
}

function str(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    try {
      data = { body: event.data ? event.data.text() : '' }
    } catch {
      data = {}
    }
  }

  const campaign = str(data.campaign)
  const title = str(data.title) || 'KudaClub'
  const options = {
    body: str(data.body) || '',
    icon: str(data.icon) || '/icons/icon-192.png',
    badge: str(data.badge) || '/icons/icon-96.png',
    tag: str(data.tag) || (campaign ? `campaign:${campaign}` : 'kudaclub'),
    renotify: true,
    data: {
      url: str(data.url) || '/',
      campaign,
      campaign_id: str(data.campaign_id),
    },
  }
  const image = str(data.image)
  if (image) options.image = image

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      trackFromWorker('push_received', campaign ? { campaign } : undefined),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const targetUrl = buildClickUrl(data.url, data.campaign)
  const campaignId = typeof data.campaign_id === 'string' ? data.campaign_id : null

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus()
          client.postMessage({
            type: 'PUSH_CLICK',
            url: targetUrl,
            campaign_id: campaignId,
            campaign: data.campaign || null,
          })
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
