const CACHE_NAME = 'empower-v2'

const APP_SHELL = [
  '/dashboard.html', '/log.html', '/login.html', '/setup.html',
  '/workout.html', '/nutrition.html', '/learn.html', '/feedback.html',
  '/checkin.html', '/calendar.html', '/index.html',
  '/hormoneSync.js', '/algorithm_v3.js', '/manifest.json'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Never intercept Supabase API calls or CDN requests
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdn.')) return
  if (e.request.method !== 'GET') return

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Fetch fresh copy and update cache in background
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return res
      }).catch(() => null)
      // Return cached immediately if available, otherwise wait for network
      return cached || network
    })
  )
})
