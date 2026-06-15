// Cache buster — clears all old caches and passes through to network.
// Bump this version to force stale installed clients (PWAs) to fetch the latest
// build: the browser sees sw.js changed, installs this SW, which wipes every old
// cache and claims open clients. v2 (2026-06-15): push the DB-based onboarding gate
// to devices still running a pre-af2432d build that re-showed setup every login.
const CACHE_NAME = 'empower-react-v2'

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
