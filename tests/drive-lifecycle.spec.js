// Live drive lifecycle: stop/save ordering, storage errors, re-entrancy, idle detection, GPS errors.
const { test, expect, openApp, sess, readStore: read, startDriving, toastText, drive: driveFrom } = require('./helpers');

const drive = (page, minutes, opts = {}) => driveFrom(page, minutes, { firstStep: 1, ...opts });
const CLOCK = new Date('2026-10-01T18:00:00.000Z');

const setHidden = (page, hidden) => page.evaluate(h => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);


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

// ── Crash safety: rtr_active checkpoint ──
const active = (over = {}) => {
  const startTime = new Date(CLOCK.getTime() - 40 * 60000).toISOString();
  return Object.assign({
    id: 'act1', startTime, endTime: null, duration: 0, isNight: false, startLocation: null, endLocation: null, weather: null,
    route: [[34.05, -118.24, null, 20], [34.06, -118.24, null, 25], [34.07, -118.24, null, 25]],
    distance: 0, lastSpeed: 11, maxSpeed: 25, avgSpeed: null, speedSamples: [20, 25, 25], notes: '', supervisor: '', supervisorLicense: '',
    lastMovedAt: CLOCK.getTime() - 35 * 60000, checkpointAt: CLOCK.getTime() - 35 * 60000,
  }, over);
};
const modalOpen = page => page.evaluate(() => document.getElementById('resume-modal').classList.contains('open'));
const btnLabels = page => page.locator('#resume-body button').allTextContents();

test('a checkpoint is written while driving and removed on a normal stop', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  const a = await read(page, 'rtr_active');
  expect(a.id).toBe(await page.evaluate(() => activeSession.id));
  expect(a.route.length).toBe(1);
  await drive(page, 3, { firstStep: 1 });   // throttled by time (15 s) so later fixes land too
  expect((await read(page, 'rtr_active')).route.length).toBeGreaterThan(2);
  await page.evaluate(() => stopDrive());
  expect(await read(page, 'rtr_active')).toBeNull();
  expect((await read(page, 'rtr_sessions')).length).toBe(1);
});

test('a checkpoint is written at once when the page is hidden', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  await page.evaluate(() => window.__geo.emit(34.0501, -118.24, 12));   // not yet due: throttled
  expect((await read(page, 'rtr_active')).route.length).toBe(1);
  await setHidden(page, true);
  expect((await read(page, 'rtr_active')).route.length).toBe(2);
  await page.evaluate(() => window.__geo.emit(34.0502, -118.24, 12));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect((await read(page, 'rtr_active')).route.length).toBe(3);
});

test('after a reload, Resume continues the same drive with its route and start time', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  await drive(page, 3, { firstStep: 1 });
  const before = await page.evaluate(() => ({ id: activeSession.id, start: activeSession.startTime, n: activeSession.route.length }));
  await page.reload();
  await page.waitForFunction(() => typeof getTotals === 'function');
  expect(await modalOpen(page)).toBe(true);
  expect(await btnLabels(page)).toEqual(['Resume drive', 'Save it now']);
  await page.getByRole('button', { name: 'Resume drive' }).click();
  await page.waitForFunction(() => activeSession && window.__geo.watchers.size > 0);
  const after = await page.evaluate(() => ({ id: activeSession.id, start: activeSession.startTime, n: activeSession.route.length, view: currentView }));
  expect(after).toEqual({ id: before.id, start: before.start, n: before.n, view: 'drive' });
  expect(await modalOpen(page)).toBe(false);
  await page.evaluate(() => window.__geo.emit(34.2, -118.24, 12));   // keeps recording on the old route
  expect(await page.evaluate(() => activeSession.route.length)).toBe(before.n + 1);
  await page.evaluate(() => stopDrive());
  const saved = await read(page, 'rtr_sessions');
  expect(saved.length).toBe(1);
  expect(saved[0].id).toBe(before.id);
  expect(saved[0].route.length).toBe(before.n + 1);
  expect(await read(page, 'rtr_active')).toBeNull();
});

test('a stale checkpoint offers Save/Discard, and Save stores a drive ending at the last fix', async ({ page }) => {
  await openApp(page, { clock: CLOCK, active: active() });
  expect(await modalOpen(page)).toBe(true);
  expect(await btnLabels(page)).toEqual(['Save it now', 'Discard']);
  expect(await page.evaluate(() => !!activeSession)).toBe(false);
  await page.getByRole('button', { name: 'Save it now' }).click();
  await page.waitForFunction(() => sessions.length === 1);
  const [s] = await read(page, 'rtr_sessions');
  expect(s.id).toBe('act1');
  expect(s.endTime).toBe(new Date(CLOCK.getTime() - 35 * 60000).toISOString());
  expect(s.duration).toBeCloseTo(5, 1);
  expect(s.route.length).toBe(3);
  expect(typeof s.isNight).toBe('boolean');
  expect(s.checkpointAt).toBeUndefined();
  expect(await read(page, 'rtr_active')).toBeNull();
  expect(await modalOpen(page)).toBe(false);
});

test('Discard removes the stale checkpoint and saves nothing', async ({ page }) => {
  await openApp(page, { clock: CLOCK, active: active() });
  await page.getByRole('button', { name: 'Discard' }).click();
  expect(await read(page, 'rtr_active')).toBeNull();
  expect(await page.evaluate(() => sessions.length)).toBe(0);
  expect(await modalOpen(page)).toBe(false);
});

test('a malformed checkpoint is removed without a prompt', async ({ page }) => {
  for (const bad of ['not json', { id: 5 }, active({ route: 'x' }), active({ startTime: 'nope' })]) {
    await openApp(page, { clock: CLOCK, active: bad });
    expect(await modalOpen(page)).toBe(false);
    expect(await read(page, 'rtr_active')).toBeNull();
    await page.evaluate(() => sessionStorage.clear());
  }
});

test('a checkpoint of a drive that is already saved is dropped silently', async ({ page }) => {
  await openApp(page, { clock: CLOCK, active: active(), sessions: [sess({ id: 'act1' })] });
  expect(await modalOpen(page)).toBe(false);
  expect(await read(page, 'rtr_active')).toBeNull();
});

test('the parent view never prompts about or touches a checkpoint', async ({ page }) => {
  await openApp(page, { clock: CLOCK, active: active(), url: '/readytoroll.html?parent=' + 'a'.repeat(32) });
  expect(await modalOpen(page)).toBe(false);
  expect((await read(page, 'rtr_active')).id).toBe('act1');
});

test('Clear all data removes the checkpoint', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await startDriving(page);
  page.on('dialog', d => d.accept());
  await page.evaluate(() => clearAllData());
  expect(await read(page, 'rtr_active')).toBeNull();
});

test('a failing checkpoint write toasts once per drive and does not break recording', async ({ page }) => {
  await openApp(page, { clock: CLOCK });
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'rtr_active') throw new DOMException('quota', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
    const t = window.toast; window.__toasts = [];
    window.toast = function (m, ms) { window.__toasts.push(m); return t(m, ms); };
  });
  await startDriving(page);
  await drive(page, 3, { firstStep: 1 });
  expect(await page.evaluate(() => window.__toasts.filter(m => /could be lost/.test(m)).length)).toBe(1);
  expect(await page.evaluate(() => activeSession.route.length)).toBeGreaterThan(2);
});
