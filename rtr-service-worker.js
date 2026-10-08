// ReadyToRoll Service Worker — offline cache + background support
//
// Registered with scope './readytoroll.html', so it only controls the
// ReadyToRoll page — never the rest of metacrystal.com. Within that page it
// only handles ReadyToRoll's own files and the map/API hosts it uses; anything
// else goes straight to the network untouched.
'use strict';

const CACHE = 'rtr-v4';
const STATIC = [
  './readytoroll.html',
  './rtr-manifest.json',
  './rtr-icon-192.svg',
  './rtr-icon-512.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Static assets that are safe to serve cache-first (versioned or rarely changing)
function isCacheFirst(url) {
  if (url.origin === self.location.origin) return /\/rtr-(manifest\.json|icon-\d+\.svg)$/.test(url.pathname);
  return url.hostname === 'unpkg.com' || url.hostname.endsWith('tile.openstreetmap.org');
}

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

// ── Activate: clear old ReadyToRoll caches (and only ours) ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('rtr-') && k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;   // sync pushes etc. go straight through
  const url = new URL(e.request.url);

  // The app page: network-first so updates are seen immediately; cached copy when offline
  if (url.origin === self.location.origin && url.pathname.endsWith('/readytoroll.html')) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put('./readytoroll.html', clone));
        }
        return response;
      }).catch(() => caches.match('./readytoroll.html'))
    );
    return;
  }

  // Sync, weather and geocoding: always live; an empty answer when offline
  if (
    (url.origin === self.location.origin && url.pathname.endsWith('/rtr-sync.php')) ||
    url.hostname === 'api.open-meteo.com' ||
    url.hostname === 'nominatim.openstreetmap.org'
  ) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Leaflet, map tiles and our icons/manifest: cache-first
  if (isCacheFirst(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
  }
  // Anything else: not ours — let the browser handle it normally
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
        icon: './rtr-icon-192.svg',
        badge: './rtr-icon-192.svg'
      })
    );
  }
});
