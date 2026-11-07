// Live drive lifecycle: stop/save ordering, storage errors, re-entrancy, idle detection, GPS errors.
const { test, expect, openApp } = require('./helpers');

const read = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
const CLOCK = new Date('2026-10-01T18:00:00.000Z');

async function drive(page, minutes, { from = [34.05, -118.24], step = 0.0005 } = {}) {
  for (let i = 0; i < minutes; i++) {
    await page.evaluate(([lat, lng]) => window.__geo.emit(lat, lng, 12), [from[0] + (i + 1) * step, from[1]]);
    await page.clock.runFor(60000);
  }
}

async function startDriving(page) {
  await page.evaluate(() => startDrive());
  await page.waitForFunction(() => window.__geo.watchers.size > 0);
  await page.evaluate(() => window.__geo.emit(34.05, -118.24, 0));   // first fix
  await page.waitForFunction(() => activeSession && activeSession.route.length > 0);
}

const setHidden = (page, hidden) => page.evaluate(h => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

const toastText = page => page.evaluate(() => document.getElementById('toast').textContent);

test('a hanging reverse geocode neither blocks recording nor delays the save', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await page.route('https://nominatim.openstreetmap.org/**', () => {});   // never answers
  await startDriving(page);
  // Start address is still loading, but later fixes are recorded
  await page.evaluate(() => { window.__geo.emit(34.0505, -118.24, 12); window.__geo.emit(34.051, -118.24, 12); });
  expect(await page.evaluate(() => activeSession.route.length)).toBe(3);
  await drive(page, 5, { from: [34.051, -118.24] });
  await page.evaluate(() => { stopDrive(); });   // don't wait for the end-address lookup
  const stored = await read(page, 'rtr_sessions');
  expect(stored.length).toBe(1);
  expect(await page.evaluate(() => [currentView, activeSession])).toEqual(['home', null]);
  // The lookup times out and the saved drive gets a coordinate fallback for its end location
  await page.clock.runFor(9000);
  await page.waitForFunction(() => sessions[0].endLocation);
  expect((await read(page, 'rtr_sessions'))[0].endLocation.address).toMatch(/^34\.\d+, -118\.\d+$/);
});

test('a storage quota error on save warns the user and does not throw', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  await drive(page, 5);
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'rtr_sessions') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await page.evaluate(() => stopDrive());
  expect(await toastText(page)).toContain('Storage full');
  expect(await page.evaluate(() => [currentView, !!activeSession, sessions.length])).toEqual(['home', false, 1]);
});

test('double-tapping Start creates one drive and one GPS watch', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await page.evaluate(() => Promise.all([startDrive(), startDrive()]));
  expect(await page.evaluate(() => window.__geo.watchers.size)).toBe(1);
  await page.evaluate(() => window.__geo.emit(34.05, -118.24, 0));
  await page.waitForFunction(() => activeSession && activeSession.route.length > 0);
  expect(await page.evaluate(() => window.__geo.watchers.size)).toBe(1);
  await drive(page, 3);
  expect(await page.evaluate(() => activeSession.route.length)).toBe(4);   // no duplicated points
  await page.evaluate(() => stopDrive());
  expect(await page.evaluate(() => [sessions.length, window.__geo.watchers.size])).toEqual([1, 0]);
});

test('a drive under a minute that went nowhere is not logged', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  await page.clock.runFor(20000);
  await page.evaluate(() => stopDrive());
  expect(await toastText(page)).toBe('Drive too short to log');
  expect(await page.evaluate(() => [sessions.length, currentView])).toEqual([0, 'home']);
  expect(await read(page, 'rtr_sessions')).toEqual([]);
});

test('coming back after a long time in the background does not auto-stop the drive', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  await drive(page, 3);
  await setHidden(page, true);
  await page.clock.runFor(15 * 60000);   // GPS paused while hidden: no fixes
  expect(await page.evaluate(() => !!activeSession)).toBe(true);
  await setHidden(page, false);
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => !!activeSession)).toBe(true);
  await drive(page, 2, { from: [34.06, -118.24] });
  await page.evaluate(() => stopDrive());
  const s = (await read(page, 'rtr_sessions'))[0];
  expect(s.duration).toBeGreaterThan(19);   // the backgrounded minutes count
});

test('the home elapsed timer stops cleanly when a drive ends', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  await drive(page, 2);
  await page.evaluate(() => { navigate('home'); navigate('drive'); stopDrive(); });
  await page.clock.runFor(5000);   // a stale tick would throw on the null activeSession
  expect(await page.evaluate(() => window._homeTimer)).toBeNull();
});

test('a repeating GPS timeout is toasted once per drive', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await page.evaluate(() => {
    const g = navigator.geolocation, orig = g.watchPosition;
    window.__geoErr = new Map();
    g.watchPosition = function (ok, err, o) { const id = orig.call(g, ok, err, o); window.__geoErr.set(id, err); return id; };
    const t = window.toast; window.__toasts = [];
    window.toast = function (m, ms) { window.__toasts.push(m); return t(m, ms); };
  });
  await page.evaluate(() => startDrive());
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { for (const err of window.__geoErr.values()) err({ code: 3, message: 'Timeout expired' }); });
    await page.clock.runFor(15000);
  }
  const gpsToasts = await page.evaluate(() => window.__toasts.filter(m => /GPS unavailable/.test(m)).length);
  expect(gpsToasts).toBe(1);
});
