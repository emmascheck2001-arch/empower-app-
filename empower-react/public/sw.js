// Em~power service worker — offline-capable app shell.
// Strategy:
//   - Precache the navigation fallback (index.html) on install so the app opens offline.
//   - Navigations (HTML): network-first, fall back to cached index.html — never serve a stale shell when online.
//   - Same-origin static assets (Vite hashed JS/CSS/images/fonts): cache-first with runtime cache-on-fetch.
//     Hashed filenames make cached assets safe forever; new builds have new names.
//   - Everything else (Supabase API, any cross-origin/dynamic request): passed straight to the network, never cached.
// Bump CACHE_VERSION to invalidate old caches. Old caches are deleted on activate.
const CACHE_VERSION = 'v73'
const CACHE_NAME = `empower-react-${CACHE_VERSION}`
const APP_SHELL = '/index.html'

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.add(APP_SHELL)).catch(() => {})
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event

  // Only handle GET; let the browser deal with POST/PATCH/etc. (Supabase writes, auth, etc.).
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never touch cross-origin requests (Supabase API, CDNs, analytics) — always network.
  if (url.origin !== self.location.origin) return

  // Navigations (page loads / SPA routes): network-first, fall back to cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Keep the shell fresh for offline use.
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(APP_SHELL, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(APP_SHELL).then(cached => cached || caches.match(request)))
    )
    return
  }

  // Same-origin static assets: cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        // Only cache successful, basic (same-origin) responses.
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
    })
  )
})
