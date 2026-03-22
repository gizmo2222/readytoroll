// ReadyToRoll Service Worker — offline cache + background support
'use strict';

const CACHE = 'rtr-v2';
const STATIC = [
  './readytoroll.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ── Install: cache all static assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache what we can; don't fail install if CDN is unreachable
      return Promise.allSettled(STATIC.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for the app HTML, APIs; cache-first for everything else ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network-first for the app itself so updates are seen immediately
  if (e.request.mode === 'navigate' || url.pathname.endsWith('readytoroll.html')) {
    e.respondWith(
      fetch(e.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match('./readytoroll.html'))
    );
    return;
  }

  // Always network-first for sync endpoint, weather, and geocoding
  if (
    (url.hostname === 'metacrystal.com' && url.pathname.includes('rtr-sync')) ||
    url.hostname === 'api.open-meteo.com' ||
    url.hostname === 'nominatim.openstreetmap.org'
  ) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Cache-first for everything else (Leaflet, map tiles, icons)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Background Sync: notify clients when back online ──
self.addEventListener('sync', e => {
  if (e.tag === 'drive-sync') {
    self.clients.matchAll().then(clients =>
      clients.forEach(c => c.postMessage({ type: 'BACK_ONLINE' }))
    );
  }
});

// ── Push notifications (future use) ──
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  if (data.title) {
    e.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body || '',
        icon: './icon-192.svg',
        badge: './icon-192.svg'
      })
    );
  }
});
