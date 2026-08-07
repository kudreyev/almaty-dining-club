/* Kudaclub PWA service worker — app shell + offline catalog/cabinet.
 * CACHE_VERSION is injected at build time (git SHA / deploy id).
 * With skipWaiting + clients.claim, users get the new SW by the second open.
 */
const CACHE_VERSION = '__CACHE_VERSION__'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const PAGES_CACHE = `${CACHE_VERSION}-pages`

const PRECACHE_URLS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/apple-touch-icon.png',
]

const CATALOG_CITIES = new Set(['almaty', 'astana'])

function isTipTopPayUrl(url) {
  const host = url.hostname
  return (
    host === 'widget.tiptoppay.kz' ||
    host === 'api.tiptoppay.kz' ||
    host.endsWith('.tiptoppay.kz')
  )
}

function shouldNeverCache(request, url) {
  if (request.method !== 'GET') return true
  if (isTipTopPayUrl(url)) return true
  if (url.origin !== self.location.origin) return true

  const path = url.pathname
  if (path.startsWith('/api/')) return true
  if (path.startsWith('/payment')) return true
  // Чекаут живёт в модалке + API; не кэшируем служебные checkout-роуты, если появятся.
  if (path.startsWith('/checkout')) return true

  return false
}

function isAppShellAsset(url) {
  if (url.origin !== self.location.origin) return false
  const path = url.pathname
  if (path.startsWith('/_next/static/')) return true
  if (path.startsWith('/icons/')) return true
  if (path === '/apple-touch-icon.png' || path === '/favicon.ico') return true
  return /\.(?:js|css|woff2?|ttf|otf|png|svg|webp|ico)$/i.test(path)
}

function isOfflineablePage(url) {
  if (url.origin !== self.location.origin) return false
  const path = url.pathname.replace(/\/$/, '') || '/'

  if (path === '/app/me' || path.startsWith('/app/me/')) return true

  const segment = path.slice(1).split('/')[0]
  if (CATALOG_CITIES.has(segment) && path === `/${segment}`) return true

  return false
}

async function cachePut(cacheName, request, response) {
  if (!response || !response.ok) return
  // Не кладём частичные/opaque ответы в кэш страниц.
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      await cache.addAll(PRECACHE_URLS)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (shouldNeverCache(request, url)) {
    // Сеть как есть — SW не перехватывает кэшированием.
    return
  }

  if (request.mode === 'navigate' && isOfflineablePage(url)) {
    event.respondWith(
      networkFirstPage(request).catch(
        () =>
          new Response('Нет сети. Откройте каталог, когда будет интернет.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          }),
      ),
    )
    return
  }

  if (isAppShellAsset(url)) {
    event.respondWith(cacheFirstShell(request))
  }
})
