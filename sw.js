const CACHE_NAME = 'empower-v10'

const STATIC_ASSETS = [
  '/hormoneSync.js', '/algorithm_v3.js', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png'
]

const HTML_PAGES = [
  '/dashboard.html', '/log.html', '/login.html', '/setup.html',
  '/workout.html', '/nutrition.html', '/learn.html', '/feedback.html',
  '/checkin.html', '/calendar.html', '/sleep.html', '/index.html'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each file individually so one failure doesn't break the whole install
      const all = [...STATIC_ASSETS, ...HTML_PAGES]
      return Promise.all(all.map(url => cache.add(url).catch(() => null)))
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      // Tell every open tab to reload so they pick up the new SW immediately
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never intercept Supabase, CDN, or non-GET requests
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdn.')) return
  if (e.request.method !== 'GET') return

  const isHTML = e.request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html') || url.pathname === '/'

  if (isHTML) {
    // Network-first for HTML — always try to get the freshest page
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request))
    )
  } else {
    // Cache-first for JS, images, etc — serve fast, update in background
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
          }
          return res
        }).catch(() => null)
        return cached || network
      })
    )
  }
})
