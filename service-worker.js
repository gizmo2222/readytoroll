// DriveLog Service Worker — offline cache + background support
'use strict';

const CACHE = 'drivelog-v1';
const STATIC = [
  './drivelog.html',
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

// ── Fetch: cache-first for static assets, network-first for APIs ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network-first for Open-Meteo weather and Nominatim geocoding
  if (url.hostname === 'api.open-meteo.com' || url.hostname === 'nominatim.openstreetmap.org') {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Cache-first for everything else (app shell, Leaflet, tiles)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful GET responses
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('./drivelog.html');
        }
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
