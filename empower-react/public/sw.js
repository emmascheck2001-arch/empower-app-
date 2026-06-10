// Cache buster — clears all old vanilla app caches and passes through to network
const CACHE_NAME = 'empower-react-v1'

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Pass everything through to the network — Vite hashed filenames handle browser caching
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request))
})
