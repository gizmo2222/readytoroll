// Shared test helpers: load readytoroll.html with every network dependency stubbed.
// Nothing leaves the machine: unknown external requests are aborted and recorded.

const { test: base, expect } = require('@playwright/test');

// Leaflet: a chainable no-op so map code runs without the CDN.
const LEAFLET_JS = `(() => {
  const mk = () => { let p; const f = function () {};
    p = new Proxy(f, { get: (t, k) => k === 'getLatLngs' ? () => [] : k === 'then' ? undefined
      : k === Symbol.toPrimitive ? () => '' : p, apply: () => p, construct: () => p });
    return p; };
  window.L = mk();
})();`;

// Fake GPS the tests drive with window.__geo.emit(lat, lng, speedMps)
function fakeGeolocation() {
  const watchers = new Map(); let n = 0;
  window.__geo = {
    watchers,
    emit(lat, lng, speed = 12) {
      const pos = { coords: { latitude: lat, longitude: lng, speed, heading: null, altitude: null, accuracy: 5 }, timestamp: Date.now() };
      for (const cb of [...watchers.values()]) cb(pos);
    },
  };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(ok) { const id = ++n; watchers.set(id, ok); return id; },
    clearWatch(id) { watchers.delete(id); },
    getCurrentPosition(ok) { ok({ coords: { latitude: 34.05, longitude: -118.24, speed: 0, accuracy: 5 }, timestamp: Date.now() }); },
  } });
}

function seedStorage(seed) {
  if (sessionStorage.getItem('__rtr_seeded')) return;
  sessionStorage.setItem('__rtr_seeded', '1');
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Open the app with seeded storage and stubbed network.
 * opts: settings, sessions, skills, milestones, deleted, weather {code,is_day,temp},
 *       store (Map shared between "devices"), url, clock (Date to install a fake clock at)
 * Returns { sync: { store, calls }, external } so tests can inspect what was sent.
 */
// Uncaught exceptions on any page opened with openApp fail the test that opened it
const pageErrors = [];
const test = base.extend({
  _noPageErrors: [async ({}, use) => {
    pageErrors.length = 0;
    await use();
    expect(pageErrors, 'uncaught page errors').toEqual([]);
  }, { auto: true }],
});

async function openApp(page, opts = {}) {
  if (!page._rtrErrHook) { page._rtrErrHook = true; page.on('pageerror', e => pageErrors.push(String(e))); }
  const store = opts.store || new Map();
  const calls = [];
  const external = [];
  const weather = Object.assign({ code: 0, is_day: 1, temp: 60 }, opts.weather || {});

  // Registered first = matched last: abort anything not stubbed below
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => { external.push(route.request().url()); route.abort(); });
  await page.route('https://unpkg.com/leaflet@*/dist/leaflet.js', r => r.fulfill({ contentType: 'text/javascript', body: LEAFLET_JS }));
  await page.route('https://unpkg.com/leaflet@*/dist/leaflet.css', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://*.tile.openstreetmap.org/**', r => r.fulfill({ status: 204, body: '' }));
  await page.route('https://api.open-meteo.com/**', r => json(r, { current: {
    temperature_2m: weather.temp, weather_code: weather.code, wind_speed_10m: 5, is_day: weather.is_day } }));
  await page.route('https://nominatim.openstreetmap.org/**', r => json(r, {
    display_name: '742 Evergreen Terrace, Springfield, CA', address: { road: 'Evergreen Terrace', city: 'Springfield', state: 'California' } }));
  await page.route('**/rtr-sync.php', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    calls.push({ raw: route.request().postData(), body });
    if (body.action === 'get') {
      if (!store.has(body.id)) return json(route, { ok: false, error: 'Not found' }, 404);
      return json(route, { ok: true, blob: store.get(body.id), updatedAt: new Date().toISOString() });
    }
    if (body.action === 'put') {
      const s = JSON.parse(body.blob);   // same shape check as rtr-sync.php
      if (s.v !== 2 || typeof s.iv !== 'string' || typeof s.ct !== 'string') return json(route, { ok: false, error: 'Invalid payload' }, 400);
      store.set(body.id, body.blob); return json(route, { ok: true, updatedAt: new Date().toISOString() });
    }
    if (body.action === 'delete') { store.delete(body.id); return json(route, { ok: true }); }
    return json(route, { ok: false, error: 'Unknown action' }, 400);
  });

  const seed = {
    rtr_settings: Object.assign({ onboardingDone: true, driverName: 'Jamie', state: 'CA' }, opts.settings || {}),
    rtr_sessions: opts.sessions || [],
  };
  if (opts.skills) seed.rtr_skills = opts.skills;
  if (opts.milestones) seed.rtr_milestones = opts.milestones;
  if (opts.deleted) seed.rtr_deleted = opts.deleted;
  await page.addInitScript(fakeGeolocation);
  await page.addInitScript(seedStorage, seed);
  if (opts.clock) await page.clock.install({ time: opts.clock });

  await page.goto(opts.url || '/readytoroll.html');
  await page.waitForFunction(() => typeof getTotals === 'function' && typeof sessions !== 'undefined');
  return { sync: { store, calls }, external };
}

let seq = 0;
/** A stored session with sensible defaults. startTime defaults to a fixed afternoon. */
function sess(over = {}) {
  seq++;
  const startTime = over.startTime || '2026-10-01T21:00:00.000Z';
  const duration = over.duration ?? 60;
  return Object.assign({
    id: 'test' + seq + Math.random().toString(36).slice(2, 8),
    startTime, endTime: new Date(new Date(startTime).getTime() + duration * 60000).toISOString(),
    duration, isNight: false, supervisor: '', supervisorLicense: '', tags: [],
    startLocation: null, endLocation: null, weather: null, route: [], distance: 0, notes: '',
  }, over);
}

/** A new browser context ("another device") sharing the config's defaults. */
async function newDevice(browser, baseURL, extra = {}) {
  const ctx = await browser.newContext({ baseURL, serviceWorkers: 'block', timezoneId: 'America/Los_Angeles', locale: 'en-US', ...extra });
  return { ctx, page: await ctx.newPage() };
}

module.exports = { test, expect, openApp, sess, newDevice };
