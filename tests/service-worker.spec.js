// Service worker rtr-service-worker.js (unit-tested in a Node vm sandbox) and its registration in the page.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, openApp, appRoot } = require('./helpers');

const ORIGIN = 'https://metacrystal.com';
const SRC = fs.readFileSync(path.join(appRoot, 'rtr-service-worker.js'), 'utf8');
const keyOf = k => (typeof k === 'string' ? k : k.url);

// Load the worker into a sandbox with fakes; returns handlers and spies.
function loadWorker({ caches: initial = {}, fetchImpl } = {}) {
  const store = new Map(Object.entries(initial).map(([n, entries]) => [n, new Map(Object.entries(entries))]));
  const handlers = {};
  const log = { fetched: [], notifications: [], posted: [], skipWaiting: 0, claimed: 0, deleted: [] };
  const mkCache = name => ({
    async add(url) {
      const r = await ctx.fetch(url);
      if (!r.ok) throw new TypeError('bad response');
      store.get(name).set(keyOf(url), r);
    },
    async put(k, r) { store.get(name).set(keyOf(k), r); },
    async match(k) { return store.get(name).get(keyOf(k)); },
  });
  const cachesFake = {
    async open(name) { if (!store.has(name)) store.set(name, new Map()); return mkCache(name); },
    async keys() { return [...store.keys()]; },
    async delete(name) { log.deleted.push(name); return store.delete(name); },
    async match(k) { for (const m of store.values()) if (m.has(keyOf(k))) return m.get(keyOf(k)); },
  };
  const clients = [{ postMessage: m => log.posted.push(m) }, { postMessage: m => log.posted.push(m) }];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (t, fn) => { handlers[t] = fn; },
    skipWaiting: () => { log.skipWaiting++; },
    clients: { claim: () => { log.claimed++; }, matchAll: async () => clients },
    registration: { showNotification: async (t, o) => { log.notifications.push({ title: t, opts: o }); } },
  };
  const ctx = vm.createContext({
    self, caches: cachesFake, URL, Response, Promise, console,
    fetch: async req => { const u = keyOf(req); log.fetched.push(u); return fetchImpl ? fetchImpl(u, req) : new Response('net:' + u); },
  });
  vm.runInContext(SRC, ctx);
  return { handlers, store, log };
}

// Fire a fetch event; resolves to { handled, response }
async function doFetch(w, url, method = 'GET') {
  let p = null;
  w.handlers.fetch({ request: { url, method }, respondWith: x => { p = x; } });
  return { handled: !!p, response: p ? await p : undefined };
}
const settle = () => new Promise(r => setTimeout(r, 0));
const lifecycle = async (w, type) => { let p; w.handlers[type]({ waitUntil: x => { p = x; } }); await p; };

test('install caches STATIC assets and skips waiting', async () => {
  const w = loadWorker();
  await lifecycle(w, 'install');
  const cached = [...w.store.get('rtr-v5').keys()];
  expect(cached).toEqual(expect.arrayContaining(['./readytoroll.html', './rtr-manifest.json', './rtr-icon-192.svg', './rtr-icon-512.svg']));
  expect(cached.some(u => u.includes('leaflet.js'))).toBe(true);
  expect(w.log.skipWaiting).toBe(1);
});

test('install survives CDN failures and still caches local files', async () => {
  const w = loadWorker({ fetchImpl: u => { if (u.startsWith('https://unpkg.com')) throw new TypeError('offline'); return new Response('ok'); } });
  await lifecycle(w, 'install');   // must not reject
  const cached = [...w.store.get('rtr-v5').keys()];
  expect(cached).toContain('./readytoroll.html');
  expect(cached.some(u => u.includes('unpkg.com'))).toBe(false);
});

test('activate deletes old rtr- caches, keeps current and non-rtr ones', async () => {
  const w = loadWorker({ caches: { 'rtr-v4': {}, 'rtr-v1': {}, 'rtr-v5': { a: 1 }, 'other-app': {}, 'workbox-x': {} } });
  await lifecycle(w, 'activate');
  expect([...w.store.keys()].sort()).toEqual(['other-app', 'rtr-v5', 'workbox-x']);
  expect(w.log.deleted.sort()).toEqual(['rtr-v1', 'rtr-v4']);
  expect(w.log.claimed).toBe(1);
});

test('non-GET requests and foreign hosts are left to the browser', async () => {
  const w = loadWorker();
  expect((await doFetch(w, ORIGIN + '/readytoroll.html', 'POST')).handled).toBe(false);
  expect((await doFetch(w, ORIGIN + '/rtr-sync.php', 'POST')).handled).toBe(false);
  expect((await doFetch(w, 'https://evil.example.com/x.js')).handled).toBe(false);
  expect((await doFetch(w, ORIGIN + '/other-page.html')).handled).toBe(false);
  expect((await doFetch(w, ORIGIN + '/rtr-evil.svg')).handled).toBe(false);
  expect(w.log.fetched).toEqual([]);
});

test('HTML is network-first and refreshes the cached copy when ok', async () => {
  const w = loadWorker({ caches: { 'rtr-v5': { './readytoroll.html': new Response('old') } } });
  const { response } = await doFetch(w, ORIGIN + '/readytoroll.html');
  expect(await response.text()).toBe('net:' + ORIGIN + '/readytoroll.html');
  await settle();
  expect(await w.store.get('rtr-v5').get('./readytoroll.html').text()).toBe('net:' + ORIGIN + '/readytoroll.html');
});

test('HTML falls back to the cached copy offline, and a bad response is not cached', async () => {
  const cachedPage = new Response('cached');
  const w = loadWorker({ caches: { 'rtr-v5': { './readytoroll.html': cachedPage } }, fetchImpl: () => { throw new TypeError('offline'); } });
  const { response } = await doFetch(w, ORIGIN + '/readytoroll.html');
  expect(response).toBe(cachedPage);

  const w2 = loadWorker({ caches: { 'rtr-v5': { './readytoroll.html': cachedPage } }, fetchImpl: () => new Response('boom', { status: 500 }) });
  const r2 = (await doFetch(w2, ORIGIN + '/readytoroll.html')).response;
  expect(r2.status).toBe(500);   // server error passes through
  await settle();
  expect(w2.store.get('rtr-v5').get('./readytoroll.html')).toBe(cachedPage);
});

test('sync, weather and geocoding go live; offline gives an empty JSON answer', async () => {
  const w = loadWorker({ fetchImpl: () => { throw new TypeError('offline'); } });
  for (const u of [ORIGIN + '/rtr-sync.php', 'https://api.open-meteo.com/v1/forecast?x=1', 'https://nominatim.openstreetmap.org/reverse?x=1']) {
    const { handled, response } = await doFetch(w, u);
    expect(handled).toBe(true);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.json()).toEqual({});
  }
  const live = loadWorker();
  const r = (await doFetch(live, 'https://api.open-meteo.com/v1/forecast')).response;
  expect(await r.text()).toBe('net:https://api.open-meteo.com/v1/forecast');
  expect(live.store.size).toBe(0);   // never cached
});

test('icons, manifest, unpkg and tiles are cache-first', async () => {
  const urls = [ORIGIN + '/rtr-manifest.json', ORIGIN + '/rtr-icon-192.svg', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'https://a.tile.openstreetmap.org/1/2/3.png'];
  for (const u of urls) {
    const hit = new Response('hit');
    const w = loadWorker({ caches: { 'rtr-v5': { [u]: hit } } });
    const { response } = await doFetch(w, u);
    expect(response).toBe(hit);
    expect(w.log.fetched).toEqual([]);   // no network when cached
  }
});

test('cache-first misses fetch the network and cache only ok responses', async () => {
  const good = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const bad = 'https://a.tile.openstreetmap.org/9/9/9.png';
  const w = loadWorker({ fetchImpl: u => (u === bad ? new Response('', { status: 404 }) : new Response('body')) });
  expect(await (await doFetch(w, good)).response.text()).toBe('body');
  expect((await doFetch(w, bad)).response.status).toBe(404);
  await settle();
  expect(w.store.get('rtr-v5').has(good)).toBe(true);
  expect(w.store.get('rtr-v5').has(bad)).toBe(false);
});

test('drive-sync background sync notifies every client; other tags do not', async () => {
  const w = loadWorker();
  w.handlers.sync({ tag: 'drive-sync' });
  await settle();
  expect(w.log.posted).toEqual([{ type: 'BACK_ONLINE' }, { type: 'BACK_ONLINE' }]);
  w.handlers.sync({ tag: 'something-else' });
  await settle();
  expect(w.log.posted.length).toBe(2);
});

test('push shows a notification only when the payload has a title', async () => {
  const w = loadWorker();
  let waited;
  w.handlers.push({ data: { json: () => ({ title: 'Keep rolling', body: 'Log a drive' }) }, waitUntil: p => { waited = p; } });
  await waited;
  expect(w.log.notifications).toEqual([{ title: 'Keep rolling', opts: { body: 'Log a drive', icon: './rtr-icon-192.svg', badge: './rtr-icon-192.svg' } }]);

  w.handlers.push({ data: { json: () => ({ title: 'T' }) }, waitUntil: p => { waited = p; } });
  await waited;
  expect(w.log.notifications[1].opts.body).toBe('');

  waited = null;
  w.handlers.push({ data: null, waitUntil: p => { waited = p; } });
  w.handlers.push({ data: { json: () => ({ body: 'no title' }) }, waitUntil: p => { waited = p; } });
  expect(waited).toBeNull();
  expect(w.log.notifications.length).toBe(2);
});

test('the page registers the worker with the readytoroll.html scope', async ({ page }) => {
  await page.addInitScript(() => {
    window.__swReg = [];
    const fake = { register(url, opts) { window.__swReg.push({ url, opts }); return Promise.resolve({}); }, addEventListener() {} };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: fake });
  });
  const { external } = await openApp(page);
  await page.waitForFunction(() => window.__swReg.length > 0);
  expect(await page.evaluate(() => window.__swReg)).toEqual([{ url: './rtr-service-worker.js', opts: { scope: './readytoroll.html' } }]);
  expect(external).toEqual([]);
});
