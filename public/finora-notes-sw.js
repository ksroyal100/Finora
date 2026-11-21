/*
 * Finora Notes: offline page shell.
 *
 * Notes themselves live in IndexedDB and need no service worker. This worker only lets the /notes PAGE open on a
 * browser refresh while offline. It is intentionally minimal and conservative:
 *   - /notes page loads: network first; if the network fails or is very slow, serve the last good copy.
 *   - /_next/static/*   : immutable, content-hashed build assets: cache first.
 *   - EVERYTHING else (every /api call, other pages, cross-origin) is left alone: the worker never touches it.
 *
 * Privacy: the cached /notes HTML contains no note content (it is read from IndexedDB in the browser) but does
 * contain the signed-in user's account chrome, so the app deletes these caches on sign-out (clearOfflineCaches).
 */
const VERSION = 'v1'
const SHELL = 'finora-notes-shell-' + VERSION
const ASSETS = 'finora-notes-assets-' + VERSION
const MAX_ASSETS = 400
const SLOW_NETWORK_MS = 3500

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('finora-notes-') && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate' && url.pathname === '/notes') {
    event.respondWith(shellNetworkFirst(req))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(assetCacheFirst(req))
  }
})

async function shellNetworkFirst(req) {
  const network = fetch(req)
  const timer = new Promise((resolve) => setTimeout(() => resolve(null), SLOW_NETWORK_MS))
  const first = await Promise.race([network.catch(() => null), timer])
  if (first) {
    // Only cache a genuine page (not a sign-in redirect, not an error page).
    const type = first.headers.get('content-type') || ''
    if (first.ok && !first.redirected && type.includes('text/html')) {
      const cache = await caches.open(SHELL)
      await cache.put('/notes', first.clone())
    }
    return first
  }
  const cached = await caches.match('/notes', { cacheName: SHELL })
  if (cached) return cached
  return network // nothing cached yet: keep waiting for the real response (or surface the real error)
}

async function assetCacheFirst(req) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) {
    await cache.put(req, res.clone())
    const keys = await cache.keys()
    if (keys.length > MAX_ASSETS) await Promise.all(keys.slice(0, keys.length - MAX_ASSETS).map((k) => cache.delete(k)))
  }
  return res
}
