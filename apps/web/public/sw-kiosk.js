/**
 * Kiosk Service Worker
 *
 * Strategy:
 *   - /api/kiosk/bundle  → stale-while-revalidate (serve cached, update in bg)
 *   - /s/ and /kiosk/    → cache-first (serve offline)
 *   - Everything else    → network-first
 *
 * Cache names are versioned so old caches are cleaned up on activate.
 */

const CACHE_VERSION = 'v1'
const BUNDLE_CACHE = `kiosk-bundle-${CACHE_VERSION}`
const SHELL_CACHE = `kiosk-shell-${CACHE_VERSION}`

const SHELL_URLS = [
  '/kiosk/',
  '/offline.html',
]

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
  )
  self.skipWaiting()
})

// ── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== BUNDLE_CACHE && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Kiosk bundle: stale-while-revalidate
  if (url.pathname.startsWith('/api/kiosk/bundle')) {
    event.respondWith(staleWhileRevalidate(request, BUNDLE_CACHE))
    return
  }

  // Survey shell + kiosk pages: cache-first
  if (
    url.pathname.startsWith('/kiosk/') ||
    url.pathname.startsWith('/s/')
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // Background sync endpoint: pass through (handled by sync queue)
  if (url.pathname === '/api/submit' || url.pathname === '/api/submit/batch') {
    return
  }

  // Default: network-first
  event.respondWith(networkFirst(request, SHELL_CACHE))
})

// ── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'kiosk-responses') {
    event.waitUntil(flushPendingResponses())
  }
})

async function flushPendingResponses() {
  // Notify the kiosk page to flush its Dexie queue
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((c) => c.postMessage({ type: 'FLUSH_RESPONSES' }))
}

// ── Cache strategies ─────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached ?? new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  return cached ?? (await fetchPromise) ?? new Response('Offline', { status: 503 })
}
